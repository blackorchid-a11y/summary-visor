import React, { useState } from 'react';
import {
    Bold, Italic, Underline, Strikethrough, Subscript, Superscript,
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    List, ListOrdered, Eraser, Undo, Redo, Type, Palette, Image
} from 'lucide-react';
import { cn } from '../lib/utils';

const HIGHLIGHT_COLORS = [
    { id: 'yellow', value: '#fef08a', label: 'Amarillo' },
    { id: 'green', value: '#bbf7d0', label: 'Verde' },
    { id: 'blue', value: '#bfdbfe', label: 'Azul' },
    { id: 'pink', value: '#fbcfe8', label: 'Rosa' },
    { id: 'orange', value: '#fed7aa', label: 'Naranja' },
];

const TEXT_COLORS = [
    { id: 'black', value: '#000000', label: 'Negro' },
    { id: 'red', value: '#ef4444', label: 'Rojo' },
    { id: 'blue', value: '#3b82f6', label: 'Azul' },
    { id: 'green', value: '#22c55e', label: 'Verde' },
    { id: 'purple', value: '#a855f7', label: 'Morado' },
];

const FONT_SIZES = [
    { id: 'small', value: '2', label: 'Pequeño' },
    { id: 'normal', value: '3', label: 'Normal' },
    { id: 'large', value: '5', label: 'Grande' },
    { id: 'xlarge', value: '7', label: 'Extra Grande' },
];

export function HighlightToolbar({ position, onHighlight, onFormat, onInsertImage, className }) {
    const [showTextColors, setShowTextColors] = useState(false);
    const [showFontSizes, setShowFontSizes] = useState(false);

    const style = position ? {
        position: 'fixed',
        top: position.top,
        left: position.left,
        transform: 'translate(-50%, -100%) translateY(-8px)',
        zIndex: 50,
    } : {};

    const handleMouseDown = (e) => {
        e.preventDefault(); // Prevent focus loss from content
    };

    const ToolButton = ({ onClick, icon: Icon, title, active }) => (
        <button
            onMouseDown={handleMouseDown}
            onClick={onClick}
            className={cn(
                "p-1.5 hover:bg-gray-100 rounded text-gray-700 transition-colors",
                active && "bg-blue-100 text-blue-600"
            )}
            title={title}
        >
            <Icon size={18} />
        </button>
    );

    const Divider = () => <div className="w-px h-5 bg-gray-200 mx-1" />;

    return (
        <div
            className={cn(
                "flex flex-wrap items-center gap-1 p-2 bg-white rounded-lg shadow-md border border-gray-200 transition-all",
                position ? "animate-in fade-in zoom-in duration-200" : "w-full max-w-fit mx-auto mb-4 sticky top-20 z-40",
                className
            )}
            style={style}
        >
            {/* Undo/Redo */}
            <div className="flex items-center gap-1">
                <ToolButton onClick={() => onFormat('undo')} icon={Undo} title="Deshacer" />
                <ToolButton onClick={() => onFormat('redo')} icon={Redo} title="Rehacer" />
            </div>
            <Divider />

            {/* Text Style */}
            <div className="flex items-center gap-1">
                <ToolButton onClick={() => onFormat('bold')} icon={Bold} title="Negrita (Ctrl+B)" />
                <ToolButton onClick={() => onFormat('italic')} icon={Italic} title="Cursiva (Ctrl+I)" />
                <ToolButton onClick={() => onFormat('underline')} icon={Underline} title="Subrayado (Ctrl+U)" />
                <ToolButton onClick={() => onFormat('strikeThrough')} icon={Strikethrough} title="Tachado" />
            </div>
            <Divider />

            {/* Subscript/Superscript */}
            <div className="flex items-center gap-1">
                <ToolButton onClick={() => onFormat('subscript')} icon={Subscript} title="Subíndice" />
                <ToolButton onClick={() => onFormat('superscript')} icon={Superscript} title="Superíndice" />
            </div>
            <Divider />

            {/* Font Size Dropdown */}
            <div className="relative">
                <button
                    onMouseDown={handleMouseDown}
                    onClick={() => setShowFontSizes(!showFontSizes)}
                    className="px-2 py-1.5 hover:bg-gray-100 rounded text-gray-700 flex items-center gap-1"
                    title="Tamaño de fuente"
                >
                    <Type size={18} />
                </button>
                {showFontSizes && (
                    <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[120px]">
                        {FONT_SIZES.map((size) => (
                            <button
                                key={size.id}
                                onMouseDown={handleMouseDown}
                                onClick={() => {
                                    onFormat('fontSize', size.value);
                                    setShowFontSizes(false);
                                }}
                                className="w-full px-3 py-1.5 text-left hover:bg-gray-100 text-sm"
                            >
                                {size.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <Divider />

            {/* Text Color */}
            <div className="relative">
                <button
                    onMouseDown={handleMouseDown}
                    onClick={() => setShowTextColors(!showTextColors)}
                    className="p-1.5 hover:bg-gray-100 rounded text-gray-700"
                    title="Color de texto"
                >
                    <Palette size={18} />
                </button>
                {showTextColors && (
                    <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-50 flex gap-1">
                        {TEXT_COLORS.map((color) => (
                            <button
                                key={color.id}
                                onMouseDown={handleMouseDown}
                                onClick={() => {
                                    onFormat('foreColor', color.value);
                                    setShowTextColors(false);
                                }}
                                className="w-6 h-6 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                                style={{ backgroundColor: color.value }}
                                title={color.label}
                            />
                        ))}
                    </div>
                )}
            </div>
            <Divider />

            {/* Lists */}
            <div className="flex items-center gap-1">
                <ToolButton onClick={() => onFormat('insertUnorderedList')} icon={List} title="Lista con viñetas" />
                <ToolButton onClick={() => onFormat('insertOrderedList')} icon={ListOrdered} title="Lista numerada" />
            </div>
            <Divider />

            {/* Alignment */}
            <div className="flex items-center gap-1">
                <ToolButton onClick={() => onFormat('justifyLeft')} icon={AlignLeft} title="Alinear a la izquierda" />
                <ToolButton onClick={() => onFormat('justifyCenter')} icon={AlignCenter} title="Centrar" />
                <ToolButton onClick={() => onFormat('justifyRight')} icon={AlignRight} title="Alinear a la derecha" />
                <ToolButton onClick={() => onFormat('justifyFull')} icon={AlignJustify} title="Justificar" />
            </div>
            <Divider />

            {/* Spacing Controls */}
            <div className="flex items-center gap-1">
                {/* Line Spacing */}
                <div className="relative group">
                    <button className="p-1.5 hover:bg-gray-100 rounded text-gray-700" title="Interlineado">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 3h18" /><path d="M3 12h18" /><path d="M3 21h18" /><path d="M21 3v18" /><path d="M21 21l-4-4" /><path d="M21 3l-4 4" />
                        </svg>
                    </button>
                    <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 hidden group-hover:block min-w-[100px]">
                        {[1.0, 1.15, 1.5, 2.0].map(val => (
                            <button
                                key={val}
                                onClick={() => onFormat('lineHeight', val)}
                                className="w-full px-3 py-1.5 text-left hover:bg-gray-100 text-sm"
                            >
                                {val}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Paragraph Spacing */}
                <div className="relative group">
                    <button className="p-1.5 hover:bg-gray-100 rounded text-gray-700" title="Espaciado de párrafo">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10h-18" /><path d="M21 6h-18" /><path d="M21 14h-18" /><path d="M21 18h-18" />
                            <path d="M6 20v-2" /><path d="M6 4v2" />
                        </svg>
                    </button>
                    <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 hidden group-hover:block min-w-[160px]">
                        <button onClick={() => onFormat('paragraphSpacing', 'add-before')} className="w-full px-3 py-1.5 text-left hover:bg-gray-100 text-sm">
                            Añadir espacio antes
                        </button>
                        <button onClick={() => onFormat('paragraphSpacing', 'remove-before')} className="w-full px-3 py-1.5 text-left hover:bg-gray-100 text-sm">
                            Quitar espacio antes
                        </button>
                        <button onClick={() => onFormat('paragraphSpacing', 'add-after')} className="w-full px-3 py-1.5 text-left hover:bg-gray-100 text-sm">
                            Añadir espacio después
                        </button>
                        <button onClick={() => onFormat('paragraphSpacing', 'remove-after')} className="w-full px-3 py-1.5 text-left hover:bg-gray-100 text-sm">
                            Quitar espacio después
                        </button>
                    </div>
                </div>
            </div>
            <Divider />

            {/* Insert Image */}
            {onInsertImage && (
                <>
                    <ToolButton onClick={onInsertImage} icon={Image} title="Insertar imagen" />
                    <Divider />
                </>
            )}

            {/* Mermaid Controls */}
            <div className="flex items-center gap-1">
                <div className="relative group">
                    <button className="p-1.5 hover:bg-gray-100 rounded text-gray-700 font-mono text-xs font-bold" title="Tema Mermaid">
                        M
                    </button>
                    <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 hidden group-hover:block min-w-[120px]">
                        {['default', 'neutral', 'dark', 'forest'].map(theme => (
                            <button
                                key={theme}
                                onClick={() => onFormat('mermaidTheme', theme)}
                                className="w-full px-3 py-1.5 text-left hover:bg-gray-100 text-sm capitalize"
                            >
                                {theme}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <Divider />

            {/* Highlight Colors */}
            <div className="flex items-center gap-1">
                {HIGHLIGHT_COLORS.map((color) => (
                    <button
                        key={color.id}
                        onMouseDown={handleMouseDown}
                        onClick={(e) => {
                            e.stopPropagation();
                            onHighlight(color.value);
                        }}
                        className="w-6 h-6 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                        style={{ backgroundColor: color.value }}
                        title={`Resaltar ${color.label}`}
                    />
                ))}
            </div>
            <Divider />

            {/* Clear Format */}
            <button
                onMouseDown={handleMouseDown}
                onClick={(e) => {
                    e.stopPropagation();
                    onHighlight(null); // Clear format
                }}
                className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Borrar formato"
            >
                <Eraser size={18} />
            </button>
        </div>
    );
}
