import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Save, BookOpen, X } from 'lucide-react';
import { HighlightToolbar } from './HighlightToolbar';
import { saveTopic } from '../lib/db';
import mermaid from 'mermaid';

mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'inherit',
});

export function TopicViewer({ topic, onBack }) {
    const contentRef = useRef(null);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const [mermaidTheme, setMermaidTheme] = useState('default');
    const [isReadingMode, setIsReadingMode] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
        if (contentRef.current) {
            contentRef.current.innerHTML = topic.content;
        }
    }, [topic.id]);

    // ESC key listener for exiting reading mode
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isReadingMode) {
                setIsReadingMode(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isReadingMode]);

    useEffect(() => {
        // Initialize mermaid diagrams
        const initMermaid = async () => {
            if (contentRef.current) {
                const nodes = contentRef.current.querySelectorAll('.mermaid');
                if (nodes.length > 0) {
                    // Reset nodes to original state
                    nodes.forEach(node => {
                        const originalCode = node.getAttribute('data-original-code');
                        if (!originalCode) {
                            node.setAttribute('data-original-code', node.textContent);
                        } else {
                            node.removeAttribute('data-processed');
                            node.innerHTML = originalCode;
                        }
                    });

                    // Re-initialize with current theme
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
    }, [topic.content, mermaidTheme]);

    const handleInput = async () => {
        // Auto-save logic removed in favor of manual save, 
        // but we keep the listener to detect changes if needed in future
    };

    const handleSave = async () => {
        const contentDiv = contentRef.current;
        if (!contentDiv) return;

        setIsSaving(true);
        try {
            const newContent = contentDiv.innerHTML;
            await saveTopic({ ...topic, content: newContent, lastModified: Date.now() });
            setLastSaved(new Date());

            // Show success feedback briefly
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

        // Find the closest block element
        while (node && node !== contentRef.current) {
            if (node.nodeType === 1 && ['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(node.tagName)) {
                node.style[style] = value;
                return;
            }
            node = node.parentNode;
        }

        // If no block found (e.g. text node directly in contentRef), wrap in div
        if (node === contentRef.current) {
            document.execCommand('formatBlock', false, 'div');
            setTimeout(() => applyBlockStyle(style, value), 0);
        }
    };

    const applyFormat = (command, value = null) => {
        if (command === 'lineHeight') {
            applyBlockStyle('lineHeight', value);
        } else if (command === 'paragraphSpacing') {
            const spacing = '1em'; // Default spacing unit
            if (value === 'add-before') applyBlockStyle('marginTop', spacing);
            if (value === 'remove-before') applyBlockStyle('marginTop', '0');
            if (value === 'add-after') applyBlockStyle('marginBottom', spacing);
            if (value === 'remove-after') applyBlockStyle('marginBottom', '0');
        } else if (command === 'mermaidTheme') {
            setMermaidTheme(value);
        } else {
            // Use styleWithCSS to generate span tags with inline styles instead of font tags
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

    // Image handling
    const handleImageInsert = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                await insertImageFile(file);
            }
        };
        input.click();
    };

    const insertImageFile = async (file) => {
        // Check file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('La imagen es demasiado grande. El tamaño máximo es 5MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            // Create a draggable wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'draggable-image';
            wrapper.style.left = '50%';
            wrapper.style.top = '100px';
            wrapper.style.transform = 'translateX(-50%)';
            wrapper.style.width = '300px';

            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.width = '100%';
            img.style.height = 'auto';
            img.style.display = 'block';
            img.className = 'rounded shadow-sm';
            img.draggable = false;

            // Add resize handle
            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'resize-handle';

            // Add delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-button';
            deleteBtn.innerHTML = '×';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                wrapper.remove();
            };

            wrapper.appendChild(img);
            wrapper.appendChild(resizeHandle);
            wrapper.appendChild(deleteBtn);

            // Make it draggable
            let isDragging = false;
            let isResizing = false;
            let startX, startY, startWidth;

            wrapper.addEventListener('mousedown', (e) => {
                if (e.target === resizeHandle) {
                    isResizing = true;
                    startX = e.clientX;
                    startWidth = wrapper.offsetWidth;
                    e.preventDefault();
                } else if (e.target !== deleteBtn) {
                    isDragging = true;
                    wrapper.classList.add('active');
                    startX = e.clientX - wrapper.offsetLeft;
                    startY = e.clientY - wrapper.offsetTop;
                    e.preventDefault();
                }
            });

            const handleMouseMove = (e) => {
                if (isDragging) {
                    wrapper.style.left = (e.clientX - startX) + 'px';
                    wrapper.style.top = (e.clientY - startY) + 'px';
                    wrapper.style.transform = 'none';
                } else if (isResizing) {
                    const newWidth = startWidth + (e.clientX - startX);
                    if (newWidth > 100 && newWidth < 800) {
                        wrapper.style.width = newWidth + 'px';
                    }
                }
            };

            const handleMouseUp = () => {
                isDragging = false;
                isResizing = false;
                wrapper.classList.remove('active');
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            // Insert into editor
            const editorContainer = contentRef.current?.parentElement;
            if (editorContainer) {
                editorContainer.appendChild(wrapper);
            }
        };
        reader.readAsDataURL(file);
    };

    useEffect(() => {
        const handlePaste = async (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) {
                        await insertImageFile(file);
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
    }, []);

    return (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
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
                            {topic.title}
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {lastSaved && (
                            <span className="text-xs text-gray-500 hidden sm:inline">
                                Guardado: {lastSaved.toLocaleTimeString()}
                            </span>
                        )}
                        <button
                            onClick={() => setIsReadingMode(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-sm hover:shadow"
                            title="Modo lectura"
                        >
                            <BookOpen size={18} />
                            <span className="hidden sm:inline">Lectura</span>
                        </button>
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
                    </div>
                </div>
            )}

            <div className="max-w-4xl mx-auto p-8 sm:p-12 relative">
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

                {/* Static Toolbar only */}
                {!isReadingMode && (
                    <HighlightToolbar
                        onHighlight={handleHighlight}
                        onFormat={handleFormat}
                        onInsertImage={handleImageInsert}
                    />
                )}

                <div
                    ref={contentRef}
                    contentEditable={!isReadingMode}
                    spellCheck={false}
                    onInput={handleInput}
                    className="prose prose-blue max-w-none topic-content outline-none min-h-[50vh] leading-normal prose-p:my-1 prose-headings:my-2"
                />
            </div>
        </div>
    );
}
