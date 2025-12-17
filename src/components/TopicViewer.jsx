import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, Save, BookOpen, X, ChevronDown, ChevronUp } from 'lucide-react';
import { HighlightToolbar } from './HighlightToolbar';
import { saveTopic, getTopic } from '../lib/db';
import { isIOSDevice, isLandscape } from '../lib/utils';
import mermaid from 'mermaid';

mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'loose',
    fontFamily: 'Nunito, sans-serif',
});

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

    const dragStateRef = useRef({
        isDragging: false,
        startX: 0,
        startY: 0,
        startLeft: 0,
        startTop: 0,
        element: null
    });

    // Detect iOS landscape mode for collapsible toolbar
    useEffect(() => {
        const checkIOSLandscape = () => {
            const iosLandscape = isIOSDevice() && isLandscape();
            setIsIOSLandscape(iosLandscape);
            // Hide toolbar by default in iOS landscape edit mode
            if (iosLandscape && isEditMode) {
                setIsToolbarVisible(false);
            }
        };

        checkIOSLandscape();
        window.addEventListener('resize', checkIOSLandscape);
        window.addEventListener('orientationchange', checkIOSLandscape);

        return () => {
            window.removeEventListener('resize', checkIOSLandscape);
            window.removeEventListener('orientationchange', checkIOSLandscape);
        };
    }, [isEditMode]);

    useEffect(() => {
        const loadTopicFromDB = async () => {
            try {
                const freshTopic = await getTopic(topic.id);
                if (freshTopic) {
                    setCurrentTopic(freshTopic);
                } else {
                    setCurrentTopic(topic);
                }
            } catch (error) {
                console.error('Error loading topic from DB:', error);
                setCurrentTopic(topic);
            }
        };

        window.scrollTo(0, 0);
        loadTopicFromDB();
    }, [topic.id]);

    // Update DOM when currentTopic changes
    useEffect(() => {
        if (contentRef.current && currentTopic.content) {
            contentRef.current.innerHTML = currentTopic.content;
            // Clear table setup flags so resize handlers are re-added
            const tables = contentRef.current.querySelectorAll('.editor-table');
            tables.forEach(table => delete table.dataset.resizeSetup);
        }
    }, [currentTopic.id, currentTopic.content]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (selectedImage) {
                    setSelectedImage(null);
                } else if (isReadingMode) {
                    setIsReadingMode(false);
                }
            }
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedImage) {
                e.preventDefault();
                selectedImage.remove();
                setSelectedImage(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isReadingMode, selectedImage]);

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
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);

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

                    mermaid.initialize({
                        startOnLoad: false,
                        theme: mermaidTheme,
                        securityLevel: 'loose',
                        fontFamily: 'Nunito, sans-serif',
                    });

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

    // Setup drag functionality for a floating image
    const setupDragForElement = useCallback((wrapper, dragHandle) => {
        const handleDragStart = (e) => {
            if (!isEditMode) return;
            if (wrapper.getAttribute('data-floating') !== 'true') return;

            e.preventDefault();
            e.stopPropagation();

            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);

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
    }, [isEditMode]);

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
                if (!isEditMode) return;
                e.preventDefault();
                e.stopPropagation();
                isResizing = true;
                startX = e.clientX || (e.touches && e.touches[0].clientX);
                startWidth = wrapper.offsetWidth;

                const handleResizeMove = (moveE) => {
                    if (!isResizing) return;
                    moveE.preventDefault();
                    const clientX = moveE.clientX || (moveE.touches && moveE.touches[0].clientX);
                    const newWidth = startWidth + (clientX - startX);
                    if (newWidth >= 50 && newWidth <= 800) {
                        wrapper.style.width = newWidth + 'px';
                    }
                };

                const handleResizeEnd = () => {
                    isResizing = false;
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
    }, [isEditMode, setupAllImageListeners]);

    const handleInput = async () => {
        // Auto-save logic removed
    };

    const handleSave = async () => {
        const contentDiv = contentRef.current;
        if (!contentDiv) return;

        setIsSaving(true);
        try {
            const selectedWrappers = contentDiv.querySelectorAll('.editor-image-wrapper.selected');
            selectedWrappers.forEach(w => w.classList.remove('selected'));

            const draggingWrappers = contentDiv.querySelectorAll('.editor-image-wrapper.dragging');
            draggingWrappers.forEach(w => w.classList.remove('dragging'));

            const newContent = contentDiv.innerHTML;
            const updatedTopic = {
                ...currentTopic,
                content: newContent,
                lastModified: Date.now()
            };

            await saveTopic(updatedTopic);
            setCurrentTopic(updatedTopic);
            setLastSaved(new Date());

            console.log('Topic saved successfully. Content length:', newContent.length);
            console.log('Contains images:', newContent.includes('editor-image-wrapper'));

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
            // Skip if already setup
            if (table.dataset.resizeSetup) return;
            table.dataset.resizeSetup = 'true';

            const cells = table.querySelectorAll('td, th');
            cells.forEach(cell => {
                // Add column resize handle
                if (!cell.querySelector('.table-col-resize-handle')) {
                    const colHandle = document.createElement('div');
                    colHandle.className = 'table-col-resize-handle';
                    colHandle.contentEditable = 'false';
                    cell.appendChild(colHandle);

                    let startX, startWidth, targetCell;

                    const onMouseDown = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startX = e.clientX;
                        targetCell = cell;
                        startWidth = cell.offsetWidth;
                        colHandle.classList.add('active');

                        const onMouseMove = (moveE) => {
                            const diff = moveE.clientX - startX;
                            const newWidth = Math.max(50, startWidth + diff);
                            targetCell.style.width = newWidth + 'px';
                        };

                        const onMouseUp = () => {
                            colHandle.classList.remove('active');
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                        };

                        document.addEventListener('mousemove', onMouseMove);
                        document.addEventListener('mouseup', onMouseUp);
                    };

                    colHandle.addEventListener('mousedown', onMouseDown);
                }

                // Add row resize handle (only to cells in the first column for simplicity)
                const cellIndex = Array.from(cell.parentElement.children).indexOf(cell);
                if (cellIndex === 0 && !cell.querySelector('.table-row-resize-handle')) {
                    const rowHandle = document.createElement('div');
                    rowHandle.className = 'table-row-resize-handle';
                    rowHandle.contentEditable = 'false';
                    cell.appendChild(rowHandle);

                    let startY, startHeight, targetRow;

                    const onMouseDown = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startY = e.clientY;
                        targetRow = cell.parentElement;
                        startHeight = targetRow.offsetHeight;
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
                    };

                    rowHandle.addEventListener('mousedown', onMouseDown);
                }
            });
        });
    }, [isEditMode]);

    // Setup table resize handlers when content changes or edit mode changes
    useEffect(() => {
        setupTableResizeHandlers();
    }, [isEditMode, setupTableResizeHandlers]);

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
            {!isReadingMode && (
                <div className={`sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-200 flex items-center justify-between shadow-sm ${isIOSLandscape ? 'ios-landscape-header px-2 py-1 pt-[calc(0.25rem+env(safe-area-inset-top))]' : 'px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]'}`}>
                    <div className={`flex items-center flex-1 min-w-0 ${isIOSLandscape ? 'gap-2' : 'gap-4'}`}>
                        <button
                            onClick={onBack}
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
                className={`mx-auto relative ${isIOSLandscape ? 'ios-landscape-editor px-2 py-4 max-w-none' : 'max-w-4xl px-3 py-4 sm:px-8 sm:py-8 lg:px-12 lg:py-12'}`}
                style={{ position: 'relative', minHeight: '80vh' }}
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
                                    />
                                )}
                            </div>
                        ) : (
                            <HighlightToolbar
                                onHighlight={handleHighlight}
                                onFormat={handleFormat}
                                onInsertImage={handleImageInsert}
                            />
                        )}
                    </>
                )}

                <div
                    ref={contentRef}
                    contentEditable={!isReadingMode && isEditMode}
                    spellCheck={false}
                    onInput={handleInput}
                    className="prose prose-blue max-w-none topic-content outline-none min-h-[50vh] leading-normal prose-p:my-1 prose-headings:my-2"
                    style={{ position: 'relative' }}
                />
            </div>
        </div>
    );
}
