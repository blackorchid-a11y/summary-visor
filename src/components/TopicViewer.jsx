import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, Save, BookOpen, X } from 'lucide-react';
import { HighlightToolbar } from './HighlightToolbar';
import { saveTopic, getTopic } from '../lib/db';
import mermaid from 'mermaid';

mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'inherit',
});

export function TopicViewer({ topic, onBack }) {
    const contentRef = useRef(null);
    const editorContainerRef = useRef(null);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const [mermaidTheme, setMermaidTheme] = useState('default');
    const [isReadingMode, setIsReadingMode] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [currentTopic, setCurrentTopic] = useState(topic);

    // Refs for drag state (avoid re-renders during drag)
    const dragStateRef = useRef({
        isDragging: false,
        startX: 0,
        startY: 0,
        startLeft: 0,
        startTop: 0,
        element: null
    });

    // Load topic from DB to ensure we have the latest content
    useEffect(() => {
        const loadTopicFromDB = async () => {
            try {
                const freshTopic = await getTopic(topic.id);
                if (freshTopic) {
                    setCurrentTopic(freshTopic);
                    if (contentRef.current) {
                        contentRef.current.innerHTML = freshTopic.content;
                        // Small delay to ensure DOM is ready
                        setTimeout(() => {
                            setupAllImageListeners();
                        }, 50);
                    }
                }
            } catch (error) {
                console.error('Error loading topic from DB:', error);
                if (contentRef.current) {
                    contentRef.current.innerHTML = topic.content;
                }
            }
        };

        window.scrollTo(0, 0);
        loadTopicFromDB();
    }, [topic.id]);

    // ESC key listener for exiting reading mode and deselecting images
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (selectedImage) {
                    setSelectedImage(null);
                } else if (isReadingMode) {
                    setIsReadingMode(false);
                }
            }
            // Delete selected image with Delete or Backspace key
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedImage) {
                e.preventDefault();
                selectedImage.remove();
                setSelectedImage(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isReadingMode, selectedImage]);

    // Click outside to deselect image
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (selectedImage && !e.target.closest('.editor-image-wrapper')) {
                setSelectedImage(null);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [selectedImage]);

    // Global mouse/touch move and up handlers for dragging
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

            // Apply constraints
            const container = editorContainerRef.current;
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
                        fontFamily: 'inherit',
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

        initMermaid();
    }, [currentTopic.content, mermaidTheme]);

    // Toggle image between inline and floating mode
    const toggleImageMode = useCallback((wrapper) => {
        if (!wrapper || !isEditMode) return;

        const isFloating = wrapper.getAttribute('data-floating') === 'true';

        if (isFloating) {
            // Convert to inline
            wrapper.setAttribute('data-floating', 'false');
            wrapper.style.position = 'relative';
            wrapper.style.left = '';
            wrapper.style.top = '';
            wrapper.style.zIndex = '';
            wrapper.style.cursor = '';

            // Remove drag handle if exists
            const dragHandle = wrapper.querySelector('.image-drag-handle');
            if (dragHandle) {
                dragHandle.remove();
            }

            // Remove mode toggle button text update
            const modeBtn = wrapper.querySelector('.image-mode-btn');
            if (modeBtn) {
                modeBtn.innerHTML = '⇱';
                modeBtn.title = 'Cambiar a modo libre (doble clic)';
            }
        } else {
            // Convert to floating
            const containerRect = editorContainerRef.current?.getBoundingClientRect();
            const wrapperRect = wrapper.getBoundingClientRect();

            // Calculate position relative to container
            let newLeft = 50;
            let newTop = 50;

            if (containerRect) {
                newLeft = wrapperRect.left - containerRect.left;
                newTop = wrapperRect.top - containerRect.top + (editorContainerRef.current?.scrollTop || 0);
            }

            wrapper.setAttribute('data-floating', 'true');
            wrapper.style.position = 'absolute';
            wrapper.style.left = newLeft + 'px';
            wrapper.style.top = newTop + 'px';
            wrapper.style.zIndex = '5';
            wrapper.style.cursor = 'move';

            // Add drag handle if not exists
            if (!wrapper.querySelector('.image-drag-handle')) {
                const dragHandle = document.createElement('span');
                dragHandle.className = 'image-drag-handle';
                dragHandle.innerHTML = '⋮⋮';
                dragHandle.contentEditable = 'false';
                dragHandle.title = 'Arrastrar imagen';
                wrapper.appendChild(dragHandle);

                // Setup drag for handle
                setupDragForElement(wrapper, dragHandle);
            }

            // Update mode toggle button
            const modeBtn = wrapper.querySelector('.image-mode-btn');
            if (modeBtn) {
                modeBtn.innerHTML = '⇲';
                modeBtn.title = 'Cambiar a modo en línea';
            }
        }

        setSelectedImage(wrapper);
    }, [isEditMode]);

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

    // Setup all event listeners for an image wrapper
    const setupImageWrapperListeners = useCallback((wrapper) => {
        if (!wrapper) return;

        // Remove existing listeners by cloning (clean slate)
        const img = wrapper.querySelector('img');
        const resizeHandle = wrapper.querySelector('.image-resize-handle');
        const deleteBtn = wrapper.querySelector('.image-delete-btn');
        const modeBtn = wrapper.querySelector('.image-mode-btn');
        const dragHandle = wrapper.querySelector('.image-drag-handle');

        // Click to select
        wrapper.onclick = (e) => {
            if (!isEditMode) return;
            e.preventDefault();
            e.stopPropagation();
            setSelectedImage(wrapper);
        };

        // Double click to toggle mode
        wrapper.ondblclick = (e) => {
            if (!isEditMode) return;
            e.preventDefault();
            e.stopPropagation();
            toggleImageMode(wrapper);
        };

        // Delete button
        if (deleteBtn) {
            deleteBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                wrapper.remove();
                setSelectedImage(null);
            };
        }

        // Mode toggle button
        if (modeBtn) {
            modeBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleImageMode(wrapper);
            };
        }

        // Resize handle
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

        // Drag handle (for floating images)
        if (dragHandle) {
            setupDragForElement(wrapper, dragHandle);
        }
    }, [isEditMode, toggleImageMode, setupDragForElement]);

    // Setup listeners for all images in the content
    const setupAllImageListeners = useCallback(() => {
        if (!contentRef.current) return;

        const images = contentRef.current.querySelectorAll('.editor-image-wrapper');
        images.forEach(wrapper => {
            setupImageWrapperListeners(wrapper);
        });
    }, [setupImageWrapperListeners]);

    // Re-setup listeners when edit mode changes
    useEffect(() => {
        setupAllImageListeners();
    }, [isEditMode, setupAllImageListeners]);

    const handleInput = async () => {
        // Auto-save logic removed in favor of manual save
    };

    const handleSave = async () => {
        const contentDiv = contentRef.current;
        if (!contentDiv) return;

        setIsSaving(true);
        try {
            // Clean up selection classes before saving
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

    const applyFormat = (command, value = null) => {
        if (command === 'lineHeight') {
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

    // Create image wrapper element with controls
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

        // Resize handle
        const resizeHandle = document.createElement('span');
        resizeHandle.className = 'image-resize-handle';
        resizeHandle.contentEditable = 'false';

        // Delete button
        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'image-delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.contentEditable = 'false';
        deleteBtn.title = 'Eliminar imagen';

        // Mode toggle button
        const modeBtn = document.createElement('span');
        modeBtn.className = 'image-mode-btn';
        modeBtn.innerHTML = '⇱';
        modeBtn.contentEditable = 'false';
        modeBtn.title = 'Cambiar a modo libre (doble clic)';

        wrapper.appendChild(img);
        wrapper.appendChild(resizeHandle);
        wrapper.appendChild(deleteBtn);
        wrapper.appendChild(modeBtn);

        // Setup listeners
        setupImageWrapperListeners(wrapper);

        return wrapper;
    }, [setupImageWrapperListeners]);

    // Insert image at cursor position or at end
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

        // Fallback: append to end
        const p = document.createElement('p');
        p.appendChild(wrapper);
        contentDiv.appendChild(p);
    }, [createImageWrapper]);

    // Image handling - file picker
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

    // Process image file and convert to base64
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

    // Handle paste event for images from clipboard
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

    // Update selected state visually
    useEffect(() => {
        if (!contentRef.current) return;

        const allWrappers = contentRef.current.querySelectorAll('.editor-image-wrapper');
        allWrappers.forEach(w => w.classList.remove('selected'));

        if (selectedImage) {
            selectedImage.classList.add('selected');
        }
    }, [selectedImage]);

    return (
        <div className="min-h-screen bg-white">
            {!isReadingMode && (
                <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-200 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <button
                            onClick={onBack}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
                            title="Volver"
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <h1 className="text-xl font-bold text-gray-900 truncate">
                            {currentTopic.title}
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {lastSaved && (
                            <span className="text-xs text-gray-500 hidden sm:inline">
                                Guardado: {lastSaved.toLocaleTimeString()}
                            </span>
                        )}
                        {!isEditMode && (
                            <button
                                onClick={() => setIsEditMode(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-sm hover:shadow"
                                title="Modo edición"
                            >
                                <span className="hidden sm:inline">Editar</span>
                            </button>
                        )}
                        <button
                            onClick={() => setIsReadingMode(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-sm hover:shadow"
                            title="Modo lectura"
                        >
                            <BookOpen size={18} />
                            <span className="hidden sm:inline">Lectura</span>
                        </button>
                        {isEditMode && (
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                                    ${isSaving
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow'
                                    }
                                `}
                            >
                                <Save size={18} />
                                {isSaving ? 'Guardado!' : 'Guardar'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div
                ref={editorContainerRef}
                className="max-w-4xl mx-auto p-8 sm:p-12 relative"
                style={{ position: 'relative', minHeight: '80vh' }}
            >
                {/* Exit reading mode button */}
                {isReadingMode && (
                    <button
                        onClick={() => setIsReadingMode(false)}
                        className="fixed top-4 right-4 z-20 p-2 bg-gray-800/80 hover:bg-gray-900 text-white rounded-full shadow-lg transition-all hover:scale-110"
                        title="Salir del modo lectura (ESC)"
                    >
                        <X size={20} />
                    </button>
                )}

                {/* Static Toolbar only in edit mode */}
                {!isReadingMode && isEditMode && (
                    <HighlightToolbar
                        onHighlight={handleHighlight}
                        onFormat={handleFormat}
                        onInsertImage={handleImageInsert}
                    />
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
