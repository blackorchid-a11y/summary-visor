import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, Save, BookOpen, X, ChevronDown, ChevronUp, Monitor, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { HighlightToolbar } from './HighlightToolbar';
import { saveTopic, getTopic } from '../lib/db';
import { isIOSDevice, isLandscape } from '../lib/utils';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';

// 'antiscript' keeps HTML labels working but strips script content from diagrams
const makeMermaidConfig = (theme) => ({
    startOnLoad: false,
    theme,
    securityLevel: 'antiscript',
    fontFamily: 'Nunito, sans-serif',
    flowchart: {
        curve: 'cardinal',
    },
});

mermaid.initialize(makeMermaidConfig('neutral'));

// contenteditable is not in DOMPurify's default attribute allowlist, but the
// editor chrome (image handles/buttons) relies on contenteditable="false"
const SANITIZE_CONFIG = { ADD_ATTR: ['contenteditable'] };

const PADDING_PRESETS = {
    none: { label: 'Sin márgenes', description: 'Sin márgenes internos', value: '0' },
    minimal: { label: 'Mínimo', description: '8px arriba/abajo, 16px lados', value: '8px 16px' },
    normal: { label: 'Normal', description: '32px arriba/abajo, 48px lados', value: '32px 48px' },
    wide: { label: 'Amplio', description: '48px arriba/abajo, 64px lados', value: '48px 64px' }
};

const WIDTH_PRESETS = [
    { value: '900px', label: 'Estrecho', description: '900px - lectura concentrada' },
    { value: '1100px', label: 'Moderado', description: '1100px' },
    { value: '1400px', label: 'Amplio', description: '1400px (recomendado)' },
    { value: 'none', label: 'Pantalla completa', description: 'Ancho máximo disponible' },
];

// Unwrap search <mark> elements from any root (live DOM or a clone for saving)
function unwrapSearchMarks(root) {
    const marks = root.querySelectorAll('mark.search-highlight');
    marks.forEach(mark => {
        // Skip marks inside image wrappers to prevent corruption
        if (mark.closest('.editor-image-wrapper')) return;

        const parent = mark.parentNode;
        if (!parent) return;

        while (mark.firstChild) {
            parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
        // Normalize to merge adjacent text nodes
        parent.normalize();
    });
}

// Serialize editor content for persistence: strip view-only state (search
// highlights, selection/drag classes, table resize handles) and restore
// positions that the viewport clamp displaced, without touching the live DOM
function serializeContent(contentDiv) {
    const clone = contentDiv.cloneNode(true);
    unwrapSearchMarks(clone);
    clone.querySelectorAll('.table-col-resize-handle, .table-row-resize-handle').forEach(el => el.remove());
    clone.querySelectorAll('.editor-image-wrapper.selected').forEach(w => w.classList.remove('selected'));
    clone.querySelectorAll('.editor-image-wrapper.dragging').forEach(w => w.classList.remove('dragging'));
    clone.querySelectorAll('[data-original-left]').forEach(el => {
        el.style.left = el.getAttribute('data-original-left');
        el.removeAttribute('data-original-left');
    });
    return clone.innerHTML;
}

export function TopicViewer({ topic, onBack }) {
    const contentRef = useRef(null);
    const editorContainerRef = useRef(null);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const [mermaidTheme, setMermaidTheme] = useState('neutral');
    const [isReadingMode, setIsReadingMode] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [currentTopic, setCurrentTopic] = useState(topic);
    const [isToolbarVisible, setIsToolbarVisible] = useState(true);
    const [isIOSLandscape, setIsIOSLandscape] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [activeHighlightColor, setActiveHighlightColor] = useState(null);
    const [pageWidth, setPageWidth] = useState('1400px'); // Will be set from topic
    const [showWidthMenu, setShowWidthMenu] = useState(false);
    const [pagePadding, setPagePadding] = useState('none'); // Will be set from topic

    // Search functionality state
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
    const searchInputRef = useRef(null);
    const originalContentRef = useRef(null); // Store original content before highlighting
    const isDirtyRef = useRef(false); // Unsaved edits in the contentEditable DOM
    const lastSavedContentRef = useRef(null); // Content we just serialized — skip re-rendering it
    const renderedMermaidThemeRef = useRef('neutral');

    const dragStateRef = useRef({
        isDragging: false,
        startX: 0,
        startY: 0,
        startLeft: 0,
        startTop: 0,
        element: null
    });

    // Detect iOS landscape mode and mobile for layout adjustments
    useEffect(() => {
        const checkLayout = () => {
            const iosLandscape = isIOSDevice() && isLandscape();
            setIsIOSLandscape(iosLandscape);
            setIsMobile(window.innerWidth <= 768);
            // Hide toolbar by default in iOS landscape edit mode
            if (iosLandscape && isEditMode) {
                setIsToolbarVisible(false);
            }
        };

        checkLayout();
        window.addEventListener('resize', checkLayout);
        window.addEventListener('orientationchange', checkLayout);

        return () => {
            window.removeEventListener('resize', checkLayout);
            window.removeEventListener('orientationchange', checkLayout);
        };
    }, [isEditMode]);

    useEffect(() => {
        const loadTopicFromDB = async () => {
            let freshTopic = null;
            try {
                freshTopic = await getTopic(topic.id);
            } catch (error) {
                console.error('Error loading topic from DB:', error);
            }
            // Fallback to the prop if the DB has no copy (or the read failed)
            const loaded = freshTopic || topic;
            setCurrentTopic(loaded);
            setPageWidth(loaded.pageWidth || '1400px');
            setPagePadding(loaded.pagePadding || 'none');
        };

        window.scrollTo(0, 0);
        loadTopicFromDB();
    }, [topic.id]);

    // Update DOM when currentTopic changes
    useEffect(() => {
        if (contentRef.current && currentTopic.content) {
            // Content we just serialized from this DOM is already rendered —
            // re-assigning innerHTML would destroy the caret and all listeners
            if (currentTopic.content === lastSavedContentRef.current) return;
            // Stored/imported content is untrusted: strip scripts and event
            // handlers before it touches the DOM
            contentRef.current.innerHTML = DOMPurify.sanitize(currentTopic.content, SANITIZE_CONFIG);
        }
    }, [currentTopic.id, currentTopic.content]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (selectedImage && !e.target.closest('.editor-image-wrapper')) {
                setSelectedImage(null);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [selectedImage]);

    useEffect(() => {
        const handleGlobalMouseMove = (e) => {
            const state = dragStateRef.current;
            if (!state.isDragging || !state.element) return;

            e.preventDefault();
            // ?? not ||: clientX === 0 at the viewport edge is a valid coordinate
            const clientX = e.clientX ?? e.touches?.[0]?.clientX;
            const clientY = e.clientY ?? e.touches?.[0]?.clientY;

            const deltaX = clientX - state.startX;
            const deltaY = clientY - state.startY;

            const newLeft = state.startLeft + deltaX;
            const newTop = state.startTop + deltaY;

            const container = contentRef.current;
            if (container) {
                const maxLeft = container.offsetWidth - state.element.offsetWidth;
                const constrainedLeft = Math.max(0, Math.min(newLeft, maxLeft));
                const constrainedTop = Math.max(0, newTop);

                state.element.style.left = constrainedLeft + 'px';
                state.element.style.top = constrainedTop + 'px';
            }
        };

        const handleGlobalMouseUp = () => {
            const state = dragStateRef.current;
            if (state.isDragging && state.element) {
                state.element.classList.remove('dragging');
                // The drop position is the user's new intent — forget any clamped original
                state.element.removeAttribute('data-original-left');
                isDirtyRef.current = true;
            }
            state.isDragging = false;
            state.element = null;
        };

        document.addEventListener('mousemove', handleGlobalMouseMove);
        document.addEventListener('mouseup', handleGlobalMouseUp);
        document.addEventListener('touchmove', handleGlobalMouseMove, { passive: false });
        document.addEventListener('touchend', handleGlobalMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleGlobalMouseMove);
            document.removeEventListener('mouseup', handleGlobalMouseUp);
            document.removeEventListener('touchmove', handleGlobalMouseMove);
            document.removeEventListener('touchend', handleGlobalMouseUp);
        };
    }, []);

    useEffect(() => {
        // After a save the DOM already shows this exact content — re-rendering
        // every diagram would only cause flicker
        if (currentTopic.content === lastSavedContentRef.current &&
            renderedMermaidThemeRef.current === mermaidTheme) {
            return;
        }
        renderedMermaidThemeRef.current = mermaidTheme;

        const initMermaid = async () => {
            if (contentRef.current) {
                const nodes = contentRef.current.querySelectorAll('.mermaid');
                if (nodes.length > 0) {
                    nodes.forEach(node => {
                        const originalCode = node.getAttribute('data-original-code');
                        if (!originalCode) {
                            node.setAttribute('data-original-code', node.textContent);
                        } else {
                            node.removeAttribute('data-processed');
                            node.innerHTML = originalCode;
                        }
                    });

                    mermaid.initialize(makeMermaidConfig(mermaidTheme));

                    try {
                        await mermaid.run({
                            nodes: nodes,
                            querySelector: '.mermaid',
                        });
                    } catch (err) {
                        console.error('Mermaid error:', err);
                    }
                }
            }
        };

        // Delay to ensure DOM is ready after innerHTML update
        const timer = setTimeout(initMermaid, 150);
        return () => clearTimeout(timer);
    }, [currentTopic.content, mermaidTheme]);

    // Search functionality
    const clearSearchHighlights = useCallback(() => {
        if (!contentRef.current) return;
        unwrapSearchMarks(contentRef.current);
    }, []);

    const performSearch = useCallback((query) => {
        if (!contentRef.current || !query.trim()) {
            clearSearchHighlights();
            setSearchResults([]);
            setCurrentSearchIndex(0);
            return;
        }

        // First, clear any existing highlights
        clearSearchHighlights();

        const searchText = query.toLowerCase();
        const results = [];

        // Walk through all text nodes and find matches (skip image wrappers to prevent data loss)
        const walker = document.createTreeWalker(
            contentRef.current,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    // Skip text nodes inside image wrappers to prevent corruption
                    if (node.parentElement?.closest('.editor-image-wrapper')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            },
            false
        );

        const nodesToHighlight = [];
        let node;
        while ((node = walker.nextNode())) {
            const text = node.textContent;
            const lowerText = text.toLowerCase();
            let startIndex = 0;
            let index;

            while ((index = lowerText.indexOf(searchText, startIndex)) !== -1) {
                nodesToHighlight.push({
                    node,
                    startOffset: index,
                    endOffset: index + searchText.length,
                    text: text.substring(index, index + searchText.length)
                });
                // Advance past the whole match: overlapping matches would make
                // surroundContents truncate the node under a later range
                startIndex = index + searchText.length;
            }
        }

        // Now apply highlights (in reverse order to preserve offsets)
        nodesToHighlight.reverse().forEach((match, i) => {
            const { node, startOffset, endOffset } = match;

            // Skip if node is no longer in document
            if (!node.parentNode) return;

            const mark = document.createElement('mark');
            mark.className = 'search-highlight';
            mark.dataset.searchIndex = nodesToHighlight.length - 1 - i;

            try {
                const range = document.createRange();
                range.setStart(node, startOffset);
                range.setEnd(node, endOffset);
                range.surroundContents(mark);
                results.push(mark);
            } catch (e) {
                // Offsets may be stale or the range may cross node boundaries; skip this match
                console.warn('Could not highlight match:', e);
            }
        });

        // Results are added in reverse, so reverse back to get correct order
        results.reverse();
        setSearchResults(results);
        setCurrentSearchIndex(0);

        // Scroll to first result
        if (results.length > 0) {
            scrollToResult(results[0]);
        }
    }, [clearSearchHighlights]);

    const scrollToResult = useCallback((element) => {
        if (!element || !contentRef.current) return;

        // Query the DOM instead of state: state may be stale right after performSearch
        contentRef.current.querySelectorAll('mark.search-highlight.current-result')
            .forEach(r => r.classList.remove('current-result'));
        element.classList.add('current-result');

        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }, []);

    const goToNextResult = useCallback(() => {
        if (searchResults.length === 0) return;
        const nextIndex = (currentSearchIndex + 1) % searchResults.length;
        setCurrentSearchIndex(nextIndex);
        scrollToResult(searchResults[nextIndex]);
    }, [searchResults, currentSearchIndex, scrollToResult]);

    const goToPreviousResult = useCallback(() => {
        if (searchResults.length === 0) return;
        const prevIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
        setCurrentSearchIndex(prevIndex);
        scrollToResult(searchResults[prevIndex]);
    }, [searchResults, currentSearchIndex, scrollToResult]);

    const closeSearch = useCallback(() => {
        setShowSearch(false);
        setSearchQuery('');
        clearSearchHighlights();
        setSearchResults([]);
        setCurrentSearchIndex(0);
    }, [clearSearchHighlights]);

    // Handle search input changes
    const handleSearchChange = useCallback((e) => {
        const query = e.target.value;
        setSearchQuery(query);
        performSearch(query);
    }, [performSearch]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Handle Cmd+F (Mac) / Ctrl+F (Windows) for search
            if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault();
                setShowSearch(true);
                // Focus search input after it renders
                setTimeout(() => {
                    searchInputRef.current?.focus();
                }, 50);
                return;
            }

            if (e.key === 'Escape') {
                if (showSearch) {
                    closeSearch();
                } else if (selectedImage) {
                    setSelectedImage(null);
                } else if (isReadingMode) {
                    setIsReadingMode(false);
                }
            }
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedImage) {
                // Don't hijack Backspace typed into a text field (e.g. the search input)
                const inTextField = e.target instanceof HTMLElement &&
                    (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
                if (!inTextField) {
                    e.preventDefault();
                    selectedImage.remove();
                    setSelectedImage(null);
                    isDirtyRef.current = true;
                }
            }
            // Navigate search results with Enter
            if (e.key === 'Enter' && showSearch && searchResults.length > 0) {
                e.preventDefault();
                if (e.shiftKey) {
                    goToPreviousResult();
                } else {
                    goToNextResult();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isReadingMode, selectedImage, showSearch, searchResults.length, goToNextResult, goToPreviousResult, closeSearch]);

    // Setup drag functionality for a floating image
    const setupDragForElement = useCallback((wrapper, dragHandle) => {
        // Bind once per node: this runs again on every edit-mode toggle and the
        // old listeners are never removed. A JS property (not an attribute) is
        // the marker because it disappears exactly when the listeners do —
        // whenever innerHTML recreates the node.
        if (dragHandle._dragBound) return;
        dragHandle._dragBound = true;

        const handleDragStart = (e) => {
            // Check edit mode via DOM instead of closure to avoid stale value
            const contentDiv = contentRef.current;
            if (!contentDiv || contentDiv.contentEditable !== 'true') return;
            if (wrapper.getAttribute('data-floating') !== 'true') return;

            e.preventDefault();
            e.stopPropagation();

            const clientX = e.clientX ?? e.touches?.[0]?.clientX;
            const clientY = e.clientY ?? e.touches?.[0]?.clientY;

            dragStateRef.current = {
                isDragging: true,
                startX: clientX,
                startY: clientY,
                startLeft: parseInt(wrapper.style.left) || 0,
                startTop: parseInt(wrapper.style.top) || 0,
                element: wrapper
            };

            wrapper.classList.add('dragging');
            setSelectedImage(wrapper);
        };

        dragHandle.addEventListener('mousedown', handleDragStart);
        dragHandle.addEventListener('touchstart', handleDragStart, { passive: false });
    }, []);

    // Toggle image between inline and floating mode
    const toggleImageMode = useCallback((wrapper) => {
        if (!wrapper || !isEditMode) return;

        const contentContainer = contentRef.current;
        if (!contentContainer) return;

        const isFloating = wrapper.getAttribute('data-floating') === 'true';

        if (isFloating) {
            // Convert from floating to inline
            wrapper.setAttribute('data-floating', 'false');
            wrapper.style.position = 'relative';
            wrapper.style.left = '';
            wrapper.style.top = '';
            wrapper.style.zIndex = '';
            wrapper.style.cursor = '';

            const dragHandle = wrapper.querySelector('.image-drag-handle');
            if (dragHandle) {
                dragHandle.remove();
            }

            const modeBtn = wrapper.querySelector('.image-mode-btn');
            if (modeBtn) {
                modeBtn.innerHTML = '⇱';
                modeBtn.title = 'Cambiar a modo libre (doble clic)';
            }

            // Move back into text flow - create a new paragraph for it
            const newParagraph = document.createElement('p');
            newParagraph.appendChild(wrapper);
            contentContainer.appendChild(newParagraph);

        } else {
            // Convert from inline to floating

            // First, get the current visual position BEFORE any DOM changes
            const wrapperRect = wrapper.getBoundingClientRect();
            const contentRect = contentContainer.getBoundingClientRect();

            // Calculate position relative to contentContainer
            const newLeft = wrapperRect.left - contentRect.left;
            const newTop = wrapperRect.top - contentRect.top;

            // Ensure non-negative values
            const finalLeft = Math.max(0, newLeft);
            const finalTop = Math.max(0, newTop);

            // Store reference to parent before moving
            const oldParent = wrapper.parentNode;

            // Move wrapper to be a direct child of contentContainer
            // This is crucial - floating images must be direct children of the positioned container
            contentContainer.appendChild(wrapper);

            // Clean up old parent if it's now empty (was just containing the image)
            if (oldParent && oldParent !== contentContainer && oldParent.childNodes.length === 0) {
                oldParent.remove();
            }

            // Now apply floating styles
            wrapper.setAttribute('data-floating', 'true');
            wrapper.style.position = 'absolute';
            wrapper.style.left = finalLeft + 'px';
            wrapper.style.top = finalTop + 'px';
            wrapper.style.zIndex = '5';
            wrapper.style.cursor = 'move';
            wrapper.style.margin = '0'; // Remove margin for absolute positioning

            // Add drag handle if not exists
            if (!wrapper.querySelector('.image-drag-handle')) {
                const dragHandle = document.createElement('span');
                dragHandle.className = 'image-drag-handle';
                dragHandle.innerHTML = '⋮⋮';
                dragHandle.contentEditable = 'false';
                dragHandle.title = 'Arrastrar imagen';
                wrapper.appendChild(dragHandle);

                setupDragForElement(wrapper, dragHandle);
            }

            const modeBtn = wrapper.querySelector('.image-mode-btn');
            if (modeBtn) {
                modeBtn.innerHTML = '⇲';
                modeBtn.title = 'Cambiar a modo en línea';
            }
        }

        setSelectedImage(wrapper);
        isDirtyRef.current = true;
    }, [isEditMode, setupDragForElement]);

    // Setup all event listeners for an image wrapper
    const setupImageWrapperListeners = useCallback((wrapper) => {
        if (!wrapper) return;

        const resizeHandle = wrapper.querySelector('.image-resize-handle');
        const deleteBtn = wrapper.querySelector('.image-delete-btn');
        const modeBtn = wrapper.querySelector('.image-mode-btn');
        const dragHandle = wrapper.querySelector('.image-drag-handle');

        wrapper.onclick = (e) => {
            if (!isEditMode) return;
            e.preventDefault();
            e.stopPropagation();
            setSelectedImage(wrapper);
        };

        wrapper.ondblclick = (e) => {
            if (!isEditMode) return;
            e.preventDefault();
            e.stopPropagation();
            toggleImageMode(wrapper);
        };

        if (deleteBtn) {
            deleteBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                wrapper.remove();
                setSelectedImage(null);
                isDirtyRef.current = true;
            };
        }

        if (modeBtn) {
            modeBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleImageMode(wrapper);
            };
        }

        if (resizeHandle) {
            let isResizing = false;
            let startX = 0;
            let startWidth = 0;

            const handleResizeStart = (e) => {
                // Check edit mode via DOM instead of closure to avoid stale value
                const contentDiv = contentRef.current;
                if (!contentDiv || contentDiv.contentEditable !== 'true') return;
                e.preventDefault();
                e.stopPropagation();
                isResizing = true;
                startX = e.clientX ?? e.touches?.[0]?.clientX;
                startWidth = wrapper.offsetWidth;

                // Same bound the drag clamp enforces: right edge stays inside the
                // container. For floating images that means accounting for their
                // left offset. Computed once — the container can't change mid-drag,
                // and reading offsetWidth per mousemove forces a reflow per frame.
                const isFloating = wrapper.getAttribute('data-floating') === 'true';
                const wrapperLeft = isFloating ? (parseInt(wrapper.style.left, 10) || 0) : 0;
                const maxWidth = contentDiv.offsetWidth - wrapperLeft;

                const handleResizeMove = (moveE) => {
                    if (!isResizing) return;
                    moveE.preventDefault();

                    const clientX = moveE.clientX ?? moveE.touches?.[0]?.clientX;
                    const newWidth = startWidth + (clientX - startX);

                    if (newWidth >= 50 && newWidth <= maxWidth) {
                        wrapper.style.width = newWidth + 'px';
                    }
                };

                const handleResizeEnd = () => {
                    isResizing = false;
                    isDirtyRef.current = true;
                    document.removeEventListener('mousemove', handleResizeMove);
                    document.removeEventListener('mouseup', handleResizeEnd);
                    document.removeEventListener('touchmove', handleResizeMove);
                    document.removeEventListener('touchend', handleResizeEnd);
                };

                document.addEventListener('mousemove', handleResizeMove);
                document.addEventListener('mouseup', handleResizeEnd);
                document.addEventListener('touchmove', handleResizeMove, { passive: false });
                document.addEventListener('touchend', handleResizeEnd);
            };

            resizeHandle.onmousedown = handleResizeStart;
            resizeHandle.ontouchstart = handleResizeStart;
        }

        if (dragHandle) {
            setupDragForElement(wrapper, dragHandle);
        }
    }, [isEditMode, toggleImageMode, setupDragForElement]);

    const setupAllImageListeners = useCallback(() => {
        if (!contentRef.current) return;

        const images = contentRef.current.querySelectorAll('.editor-image-wrapper');
        images.forEach(wrapper => {
            setupImageWrapperListeners(wrapper);
        });
    }, [setupImageWrapperListeners]);

    useEffect(() => {
        setupAllImageListeners();
    }, [isEditMode, setupAllImageListeners, currentTopic.content]);

    // Ensure floating images stay within bounds when the container narrows.
    // The clamp is reversible: the user's intended position is kept in
    // data-original-left and restored when space allows (and on save, so a
    // transient window narrowing never corrupts the stored layout).
    useEffect(() => {
        const checkFloatingImages = () => {
            const contentDiv = contentRef.current;
            if (!contentDiv) return;

            const containerWidth = contentDiv.offsetWidth;
            const floatingImages = contentDiv.querySelectorAll('.editor-image-wrapper[data-floating="true"]');

            floatingImages.forEach(img => {
                const intendedLeft = img.hasAttribute('data-original-left')
                    ? parseInt(img.getAttribute('data-original-left'), 10)
                    : parseInt(img.style.left || '0', 10);
                const imgWidth = img.offsetWidth;

                if (intendedLeft + imgWidth > containerWidth) {
                    img.setAttribute('data-original-left', intendedLeft + 'px');
                    img.style.left = Math.max(0, containerWidth - imgWidth) + 'px';
                } else if (img.hasAttribute('data-original-left')) {
                    img.style.left = intendedLeft + 'px';
                    img.removeAttribute('data-original-left');
                }
            });
        };

        // Coalesce resize bursts into one check per frame
        let frame = null;
        const scheduleCheck = () => {
            if (frame) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(checkFloatingImages);
        };

        checkFloatingImages();
        window.addEventListener('resize', scheduleCheck);
        window.addEventListener('orientationchange', scheduleCheck);

        return () => {
            if (frame) cancelAnimationFrame(frame);
            window.removeEventListener('resize', scheduleCheck);
            window.removeEventListener('orientationchange', scheduleCheck);
        };
    }, [pageWidth, isEditMode, currentTopic.content]);

    const handleInput = () => {
        isDirtyRef.current = true;
    };

    // Warn before discarding unsaved edits (app close / refresh)
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isDirtyRef.current) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    const handleBackClick = () => {
        if (isDirtyRef.current && !window.confirm('Tienes cambios sin guardar. ¿Salir sin guardar?')) {
            return;
        }
        onBack();
    };

    const handleSave = async () => {
        const contentDiv = contentRef.current;
        if (!contentDiv) return;

        setIsSaving(true);
        try {
            // Serialize from a clone: the live DOM (search highlights, selection,
            // caret) stays untouched, and view-only state never reaches the DB
            const newContent = serializeContent(contentDiv);
            const updatedTopic = {
                ...currentTopic,
                content: newContent,
                lastModified: Date.now()
            };

            await saveTopic(updatedTopic);
            lastSavedContentRef.current = newContent;
            setCurrentTopic(updatedTopic);
            isDirtyRef.current = false;
            setLastSaved(new Date());

            const imageCount = (newContent.match(/editor-image-wrapper/g) || []).length;
            console.log('Topic saved successfully. Content length:', newContent.length, 'Images:', imageCount);

            setTimeout(() => setIsSaving(false), 1000);
        } catch (error) {
            console.error('Error saving:', error);
            setIsSaving(false);
            alert('Error al guardar los cambios');
        }
    };

    const applyBlockStyle = (style, value) => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        let node = range.commonAncestorContainer;

        while (node && node !== contentRef.current) {
            if (node.nodeType === 1 && ['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(node.tagName)) {
                node.style[style] = value;
                return;
            }
            node = node.parentNode;
        }

        if (node === contentRef.current) {
            document.execCommand('formatBlock', false, 'div');
            setTimeout(() => applyBlockStyle(style, value), 0);
        }
    };

    const insertTableAtCursor = useCallback((rows, cols) => {
        const contentDiv = contentRef.current;
        if (!contentDiv) return;

        // Create table element
        const table = document.createElement('table');
        table.className = 'editor-table';
        table.style.cssText = 'width: 100%; border-collapse: collapse; margin: 1em 0;';

        // Create tbody
        const tbody = document.createElement('tbody');

        for (let i = 0; i < rows; i++) {
            const tr = document.createElement('tr');
            for (let j = 0; j < cols; j++) {
                const td = document.createElement('td');
                td.style.cssText = 'border: 1px solid #d1d5db; padding: 8px 12px; min-width: 50px; position: relative;';
                td.innerHTML = '<br>'; // Empty cell with line break for editing
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);

        // Create a wrapper div for the table
        const wrapper = document.createElement('div');
        wrapper.className = 'editor-table-wrapper';
        wrapper.style.cssText = 'position: relative; margin: 1em 0; overflow-x: auto;';
        wrapper.appendChild(table);

        // Insert at cursor position
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (contentDiv.contains(range.commonAncestorContainer)) {
                range.deleteContents();
                range.insertNode(wrapper);

                // Move cursor after table
                range.setStartAfter(wrapper);
                range.setEndAfter(wrapper);
                selection.removeAllRanges();
                selection.addRange(range);

                // Add a paragraph after for continued editing
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                wrapper.insertAdjacentElement('afterend', p);

                return;
            }
        }

        // Fallback: append to content
        contentDiv.appendChild(wrapper);
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        contentDiv.appendChild(p);
    }, []);

    const applyFormat = (command, value = null) => {
        if (command === 'insertTable') {
            insertTableAtCursor(value.rows, value.cols);
        } else if (command === 'lineHeight') {
            applyBlockStyle('lineHeight', value);
        } else if (command === 'paragraphSpacing') {
            const spacing = '1em';
            if (value === 'add-before') applyBlockStyle('marginTop', spacing);
            if (value === 'remove-before') applyBlockStyle('marginTop', '0');
            if (value === 'add-after') applyBlockStyle('marginBottom', spacing);
            if (value === 'remove-after') applyBlockStyle('marginBottom', '0');
        } else if (command === 'mermaidTheme') {
            setMermaidTheme(value);
        } else {
            document.execCommand('styleWithCSS', false, true);
            document.execCommand(command, false, value);
        }
    };

    const handleHighlight = (color) => {
        if (color) {
            applyFormat('hiliteColor', color);
        } else {
            applyFormat('removeFormat');
        }
    };

    const handleFormat = (type, value = null) => {
        applyFormat(type, value);
    };

    const createImageWrapper = useCallback((imgSrc, initialWidth = 300) => {
        const wrapper = document.createElement('span');
        wrapper.className = 'editor-image-wrapper';
        wrapper.contentEditable = 'false';
        wrapper.setAttribute('data-floating', 'false');
        wrapper.style.cssText = `display: inline-block; max-width: 100%; width: ${initialWidth}px; margin: 8px; position: relative; vertical-align: top;`;

        const img = document.createElement('img');
        img.src = imgSrc;
        img.style.cssText = 'width: 100%; height: auto; display: block; border-radius: 4px;';
        img.draggable = false;

        const resizeHandle = document.createElement('span');
        resizeHandle.className = 'image-resize-handle';
        resizeHandle.contentEditable = 'false';

        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'image-delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.contentEditable = 'false';
        deleteBtn.title = 'Eliminar imagen';

        const modeBtn = document.createElement('span');
        modeBtn.className = 'image-mode-btn';
        modeBtn.innerHTML = '⇱';
        modeBtn.contentEditable = 'false';
        modeBtn.title = 'Cambiar a modo libre (doble clic)';

        wrapper.appendChild(img);
        wrapper.appendChild(resizeHandle);
        wrapper.appendChild(deleteBtn);
        wrapper.appendChild(modeBtn);

        setupImageWrapperListeners(wrapper);

        return wrapper;
    }, [setupImageWrapperListeners]);

    const insertImageAtCursor = useCallback((imgSrc) => {
        const contentDiv = contentRef.current;
        if (!contentDiv) return;

        const wrapper = createImageWrapper(imgSrc);

        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);

            if (contentDiv.contains(range.commonAncestorContainer)) {
                range.deleteContents();
                range.insertNode(wrapper);

                range.setStartAfter(wrapper);
                range.setEndAfter(wrapper);
                selection.removeAllRanges();
                selection.addRange(range);

                const space = document.createTextNode('\u00A0');
                if (wrapper.nextSibling) {
                    wrapper.parentNode.insertBefore(space, wrapper.nextSibling);
                } else {
                    wrapper.parentNode.appendChild(space);
                }

                return;
            }
        }

        const p = document.createElement('p');
        p.appendChild(wrapper);
        contentDiv.appendChild(p);
    }, [createImageWrapper]);

    useEffect(() => {
        isDirtyRef.current = false;
    }, [currentTopic.id]);

    const handleImageInsert = useCallback(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                await processImageFile(file);
            }
        };
        input.click();
    }, []);

    const processImageFile = useCallback(async (file) => {
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('La imagen es demasiado grande. El tamaño máximo es 5MB.');
            return;
        }

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                insertImageAtCursor(e.target.result);
                isDirtyRef.current = true;
                resolve();
            };
            reader.onerror = () => {
                alert('Error al leer la imagen');
                resolve();
            };
            reader.readAsDataURL(file);
        });
    }, [insertImageAtCursor]);

    useEffect(() => {
        const handlePaste = async (e) => {
            if (!isEditMode) return;

            const items = e.clipboardData?.items;
            if (!items) return;

            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) {
                        await processImageFile(file);
                    }
                    break;
                }
            }
        };

        const contentDiv = contentRef.current;
        if (contentDiv) {
            contentDiv.addEventListener('paste', handlePaste);
            return () => contentDiv.removeEventListener('paste', handlePaste);
        }
    }, [isEditMode, processImageFile]);

    useEffect(() => {
        if (!contentRef.current) return;

        const allWrappers = contentRef.current.querySelectorAll('.editor-image-wrapper');
        allWrappers.forEach(w => w.classList.remove('selected'));

        if (selectedImage) {
            selectedImage.classList.add('selected');
        }
    }, [selectedImage]);

    // Setup table resize functionality
    const setupTableResizeHandlers = useCallback(() => {
        if (!contentRef.current || !isEditMode) return;

        const tables = contentRef.current.querySelectorAll('.editor-table');
        tables.forEach(table => {
            const cells = table.querySelectorAll('td, th');
            cells.forEach(cell => {
                // Idempotent: a handle with a live listener carries the _bound JS
                // property (lost exactly when innerHTML recreates the node, along
                // with the listener). Skipping bound handles is what lets the
                // MutationObserver below settle — unconditional remove+append
                // re-triggered it forever.
                const existingColHandle = cell.querySelector('.table-col-resize-handle');
                if (existingColHandle?._bound) return;
                if (existingColHandle) {
                    existingColHandle.remove();
                }

                // Add column resize handle
                const colHandle = document.createElement('div');
                colHandle.className = 'table-col-resize-handle';
                colHandle.contentEditable = 'false';
                colHandle._bound = true;
                cell.appendChild(colHandle);

                colHandle.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const startX = e.clientX;
                    const startWidth = cell.offsetWidth;
                    colHandle.classList.add('active');

                    const onMouseMove = (moveE) => {
                        const diff = moveE.clientX - startX;
                        const newWidth = Math.max(50, startWidth + diff);
                        cell.style.width = newWidth + 'px';
                    };

                    const onMouseUp = () => {
                        colHandle.classList.remove('active');
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                    };

                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                });

                // Add row resize handle (only to cells in the first column)
                const cellIndex = Array.from(cell.parentElement.children).indexOf(cell);
                if (cellIndex === 0) {
                    // Remove existing row resize handle before adding new one
                    const existingRowHandle = cell.querySelector('.table-row-resize-handle');
                    if (existingRowHandle) {
                        existingRowHandle.remove();
                    }

                    const rowHandle = document.createElement('div');
                    rowHandle.className = 'table-row-resize-handle';
                    rowHandle.contentEditable = 'false';
                    rowHandle._bound = true;
                    cell.appendChild(rowHandle);

                    rowHandle.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const startY = e.clientY;
                        const targetRow = cell.parentElement;
                        const startHeight = targetRow.offsetHeight;
                        rowHandle.classList.add('active');

                        const onMouseMove = (moveE) => {
                            const diff = moveE.clientY - startY;
                            const newHeight = Math.max(30, startHeight + diff);
                            Array.from(targetRow.children).forEach(td => {
                                td.style.height = newHeight + 'px';
                            });
                        };

                        const onMouseUp = () => {
                            rowHandle.classList.remove('active');
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                        };

                        document.addEventListener('mousemove', onMouseMove);
                        document.addEventListener('mouseup', onMouseUp);
                    });
                }
            });
        });
    }, [isEditMode]);

    // Setup table resize handlers when content changes or edit mode changes
    useEffect(() => {
        setupTableResizeHandlers();
    }, [isEditMode, setupTableResizeHandlers]);

    // Listener para aplicar highlight automáticamente cuando hay modo highlight activo
    useEffect(() => {
        if (!isEditMode || !activeHighlightColor) return;

        const handleSelectionChange = () => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

            // Verificar que la selección está dentro del editor
            const contentDiv = contentRef.current;
            if (!contentDiv) return;

            const range = selection.getRangeAt(0);
            if (!contentDiv.contains(range.commonAncestorContainer)) return;

            // Aplicar el highlight
            document.execCommand('styleWithCSS', false, true);
            document.execCommand('hiliteColor', false, activeHighlightColor);

            // Colapsar la selección después de aplicar (opcional, para UX más fluida)
            selection.collapseToEnd();
        };

        // Usamos mouseup en vez de selectionchange para mejor control
        const handleMouseUp = (e) => {
            // Pequeño delay para asegurar que la selección se completó
            setTimeout(handleSelectionChange, 10);
        };

        const contentDiv = contentRef.current;
        if (contentDiv) {
            contentDiv.addEventListener('mouseup', handleMouseUp);
            return () => contentDiv.removeEventListener('mouseup', handleMouseUp);
        }
    }, [isEditMode, activeHighlightColor]);

    // Desactivar modo highlight cuando se sale del modo edición
    useEffect(() => {
        if (!isEditMode) {
            setActiveHighlightColor(null);
        }
    }, [isEditMode]);

    // Guardar preferencia de ancho de página por documento
    const handleWidthChange = async (width) => {
        setPageWidth(width);
        setShowWidthMenu(false);

        // Save to current topic in database
        try {
            const updatedTopic = {
                ...currentTopic,
                pageWidth: width,
                lastModified: Date.now()
            };
            await saveTopic(updatedTopic);
            setCurrentTopic(updatedTopic);
        } catch (error) {
            console.error('Error saving page width:', error);
        }
    };

    // Calcular el padding efectivo basado en preferencia del usuario
    const getEffectivePadding = () => {
        return PADDING_PRESETS[pagePadding]?.value || PADDING_PRESETS.normal.value;
    };

    // Cerrar menú de ancho al hacer clic afuera
    useEffect(() => {
        if (!showWidthMenu) return;

        const handleClickOutside = (e) => {
            if (!e.target.closest('.width-menu-container')) {
                setShowWidthMenu(false);
            }
        };

        // Pequeño delay para evitar que el clic que abre el menú también lo cierre
        const timeoutId = setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('click', handleClickOutside);
        };
    }, [showWidthMenu]);

    // Also setup after table insertion
    useEffect(() => {
        if (!contentRef.current) return;

        const observer = new MutationObserver(() => {
            setupTableResizeHandlers();
        });

        observer.observe(contentRef.current, {
            childList: true,
            subtree: true
        });

        return () => observer.disconnect();
    }, [setupTableResizeHandlers]);

    return (
        <div className="min-h-screen bg-white">
            {/* Search Bar */}
            {showSearch && (
                <div className="fixed top-0 right-0 z-50 p-3" style={{ paddingTop: 'calc(12px + env(safe-area-inset-top))' }}>
                    <div className="flex items-center gap-2 bg-white rounded-lg shadow-lg border border-gray-300 px-3 py-2">
                        <Search size={18} className="text-gray-400 flex-shrink-0" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={handleSearchChange}
                            placeholder="Buscar en el documento..."
                            className="outline-none text-sm w-48 sm:w-64"
                            autoFocus
                        />
                        {searchQuery && (
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                                {searchResults.length > 0
                                    ? `${currentSearchIndex + 1}/${searchResults.length}`
                                    : 'Sin resultados'}
                            </span>
                        )}
                        <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
                            <button
                                onClick={goToPreviousResult}
                                disabled={searchResults.length === 0}
                                className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Anterior (Shift+Enter)"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                onClick={goToNextResult}
                                disabled={searchResults.length === 0}
                                className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Siguiente (Enter)"
                            >
                                <ChevronRight size={16} />
                            </button>
                            <button
                                onClick={closeSearch}
                                className="p-1 hover:bg-gray-100 rounded ml-1"
                                title="Cerrar (Esc)"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!isReadingMode && (
                <div
                    className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-200 flex items-center justify-between shadow-sm"
                    style={{
                        paddingLeft: isMobile ? '6px' : '16px',
                        paddingRight: isMobile ? '6px' : '16px',
                        paddingTop: isMobile ? 'calc(4px + env(safe-area-inset-top))' : 'calc(12px + env(safe-area-inset-top))',
                        paddingBottom: isMobile ? '4px' : '12px'
                    }}
                >
                    <div className={`flex items-center flex-1 min-w-0 ${isIOSLandscape ? 'gap-2' : 'gap-4'}`}>
                        <button
                            onClick={handleBackClick}
                            className={`hover:bg-gray-100 rounded-full transition-colors text-gray-600 ${isIOSLandscape ? 'p-1' : 'p-2'}`}
                            title="Volver"
                        >
                            <ArrowLeft size={isIOSLandscape ? 20 : 24} />
                        </button>
                        <h1 className={`font-bold text-gray-900 truncate ${isIOSLandscape ? 'text-base' : 'text-xl'}`}>
                            {currentTopic.title}
                        </h1>
                    </div>

                    <div className={`flex items-center ${isIOSLandscape ? 'gap-1' : 'gap-3'}`}>
                        {lastSaved && (
                            <span className="text-xs text-gray-500 hidden sm:inline">
                                Guardado: {lastSaved.toLocaleTimeString()}
                            </span>
                        )}
                        {!isEditMode && (
                            <button
                                onClick={() => setIsEditMode(true)}
                                className={`flex items-center gap-2 rounded-lg font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-sm hover:shadow ${isIOSLandscape ? 'px-2 py-1 text-sm' : 'px-4 py-2'}`}
                                title="Modo edición"
                            >
                                <span className="hidden sm:inline">Editar</span>
                            </button>
                        )}
                        <div className="relative width-menu-container">
                            <button
                                onClick={() => setShowWidthMenu(!showWidthMenu)}
                                className={`flex items-center gap-2 rounded-lg font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-sm hover:shadow ${isIOSLandscape ? 'px-2 py-1 text-sm' : 'px-4 py-2'}`}
                                title="Ancho de página"
                            >
                                <Monitor size={isIOSLandscape ? 16 : 18} />
                                <span className="hidden md:inline">Ancho</span>
                            </button>
                            {showWidthMenu && (
                                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100">
                                        Ancho de página
                                    </div>
                                    {WIDTH_PRESETS.map(({ value, label, description }) => (
                                        <button
                                            key={value}
                                            onClick={() => handleWidthChange(value)}
                                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors ${pageWidth === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                        >
                                            <div className="font-medium">{label}</div>
                                            <div className="text-xs text-gray-500">{description}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => setIsReadingMode(true)}
                            className={`flex items-center gap-2 rounded-lg font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-sm hover:shadow ${isIOSLandscape ? 'px-2 py-1 text-sm' : 'px-4 py-2'}`}
                            title="Modo lectura"
                        >
                            <BookOpen size={isIOSLandscape ? 16 : 18} />
                            <span className="hidden sm:inline">Lectura</span>
                        </button>
                        {isEditMode && (
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className={`
                                    flex items-center gap-2 rounded-lg font-medium transition-all
                                    ${isIOSLandscape ? 'px-2 py-1 text-sm' : 'px-4 py-2'}
                                    ${isSaving
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow'
                                    }
                                `}
                            >
                                <Save size={isIOSLandscape ? 16 : 18} />
                                {isSaving ? 'Guardado!' : 'Guardar'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div
                ref={editorContainerRef}
                className={`relative ${pageWidth !== 'none' ? 'mx-auto' : ''}`}
                style={{
                    position: 'relative',
                    minHeight: '80vh',
                    maxWidth: pageWidth === 'none' ? '100%' : (isMobile ? '100%' : pageWidth),
                    padding: pageWidth === 'none' ? '0' : getEffectivePadding()
                }}
            >
                {isReadingMode && (
                    <button
                        onClick={() => setIsReadingMode(false)}
                        className="fixed top-4 right-4 z-20 p-2 bg-gray-800/80 hover:bg-gray-900 text-white rounded-full shadow-lg transition-all hover:scale-110"
                        title="Salir del modo lectura (ESC)"
                    >
                        <X size={20} />
                    </button>
                )}

                {!isReadingMode && isEditMode && (
                    <>
                        {/* iOS Landscape: Collapsible toolbar */}
                        {isIOSLandscape ? (
                            <div className="ios-toolbar-container">
                                <button
                                    onClick={() => setIsToolbarVisible(!isToolbarVisible)}
                                    className="ios-toolbar-toggle flex items-center justify-center gap-2 w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 text-sm font-medium transition-colors mb-2"
                                >
                                    {isToolbarVisible ? (
                                        <>
                                            <ChevronUp size={16} />
                                            Ocultar herramientas
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown size={16} />
                                            Mostrar herramientas
                                        </>
                                    )}
                                </button>
                                {isToolbarVisible && (
                                    <HighlightToolbar
                                        onHighlight={handleHighlight}
                                        onFormat={handleFormat}
                                        onInsertImage={handleImageInsert}
                                        className="ios-landscape-toolbar"
                                        activeHighlightColor={activeHighlightColor}
                                        onHighlightModeChange={setActiveHighlightColor}
                                    />
                                )}
                            </div>
                        ) : (
                            <HighlightToolbar
                                onHighlight={handleHighlight}
                                onFormat={handleFormat}
                                onInsertImage={handleImageInsert}
                                activeHighlightColor={activeHighlightColor}
                                onHighlightModeChange={setActiveHighlightColor}
                            />
                        )}
                    </>
                )}

                <div
                    ref={contentRef}
                    contentEditable={!isReadingMode && isEditMode}
                    spellCheck={false}
                    onInput={handleInput}
                    className={`prose prose-blue max-w-none topic-content outline-none min-h-[50vh] leading-normal prose-p:my-1 prose-headings:my-2 ${activeHighlightColor ? 'highlight-mode-active' : ''} ${pageWidth === 'none' ? 'full-width-mode' : ''}`}
                    style={{
                        position: 'relative',
                        '--highlight-color': activeHighlightColor || '#fef08a'
                    }}
                />
            </div>
        </div>
    );
}
