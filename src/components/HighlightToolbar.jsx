import React, { useState } from 'react';
import {
    Bold, Italic, Underline, Strikethrough, Subscript, Superscript,
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    List, ListOrdered, Eraser, Undo, Redo, Type, Palette, Image, Table
} from 'lucide-react';
import { cn } from '../lib/utils';

const HIGHLIGHT_COLORS = [
    { id: 'yellow', value: '#fef08a', label: 'Amarillo' },
    { id: 'green', value: '#bbf7d0', label: 'Verde' },
    { id: 'blue', value: '#bfdbfe', label: 'Azul' },
    { id: 'pink', value: '#fbcfe8', label: 'Rosa' },
    { id: 'orange', value: '#fed7aa', label: 'Naranja' },
    { id: 'purple', value: '#e9d5ff', label: 'Lila' },
    { id: 'cyan', value: '#a5f3fc', label: 'Cian' },
    { id: 'red', value: '#fecaca', label: 'Rojo claro' },
    { id: 'gray', value: '#e5e7eb', label: 'Gris' },
];

// Quick access colors (original)
const QUICK_TEXT_COLORS = [
    { id: 'black', value: '#000000', label: 'Negro' },
    { id: 'red', value: '#ef4444', label: 'Rojo' },
    { id: 'blue', value: '#3b82f6', label: 'Azul' },
    { id: 'green', value: '#22c55e', label: 'Verde' },
    { id: 'purple', value: '#a855f7', label: 'Morado' },
    { id: 'orange', value: '#f97316', label: 'Naranja' },
    { id: 'pink', value: '#ec4899', label: 'Rosa' },
    { id: 'gray', value: '#4b5563', label: 'Gris' },
    { id: 'teal', value: '#0d9488', label: 'Verde azulado' },
];

// Extended color palette grid (like Google Docs / image reference)
const COLOR_PALETTE = [
    // Row 1: Grayscale
    ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff'],
    // Row 2: Primary bright
    ['#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff', '#ff6d6d'],
    // Row 3: Pastels light
    ['#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc'],
    // Row 4: Pastels medium
    ['#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd'],
    // Row 5: Saturated light
    ['#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0'],
    // Row 6: Saturated medium
    ['#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79'],
    // Row 7: Dark
    ['#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47'],
    // Row 8: Very dark
    ['#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130'],
];

const FONT_SIZES = [
    { id: 'small', value: '2', label: 'Pequeño' },
    { id: 'normal', value: '3', label: 'Normal' },
    { id: 'large', value: '5', label: 'Grande' },
    { id: 'xlarge', value: '7', label: 'Extra Grande' },
];

// Storage keys for custom colors
const CUSTOM_TEXT_COLORS_KEY = 'highlight-toolbar-custom-text-colors';
const CUSTOM_HIGHLIGHT_COLORS_KEY = 'highlight-toolbar-custom-highlight-colors';

// Load custom colors from localStorage
const loadCustomColors = (key) => {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

// Save custom colors to localStorage
const saveCustomColors = (key, colors) => {
    try {
        localStorage.setItem(key, JSON.stringify(colors));
    } catch {
        // Ignore storage errors
    }
};

// Highlight-specific color palette (lighter/pastel colors suitable for highlighting)
const HIGHLIGHT_PALETTE = [
    // Row 1: Very light pastels
    ['#fff9c4', '#ffe0b2', '#ffccbc', '#f8bbd9', '#e1bee7', '#d1c4e9', '#c5cae9', '#bbdefb', '#b2ebf2', '#b2dfdb'],
    // Row 2: Light pastels
    ['#fff59d', '#ffcc80', '#ffab91', '#f48fb1', '#ce93d8', '#b39ddb', '#9fa8da', '#90caf9', '#80deea', '#80cbc4'],
    // Row 3: Medium pastels
    ['#fef08a', '#fed7aa', '#fecaca', '#fbcfe8', '#e9d5ff', '#c4b5fd', '#a5b4fc', '#bfdbfe', '#a5f3fc', '#99f6e4'],
    // Row 4: Soft colors
    ['#fde047', '#fdba74', '#fca5a5', '#f9a8d4', '#d8b4fe', '#a78bfa', '#818cf8', '#93c5fd', '#67e8f9', '#5eead4'],
    // Row 5: Standard highlights
    ['#facc15', '#fb923c', '#f87171', '#ec4899', '#c084fc', '#8b5cf6', '#6366f1', '#60a5fa', '#22d3ee', '#2dd4bf'],
    // Row 6: Greens and naturals
    ['#d9ead3', '#b6d7a8', '#93c47d', '#a3e635', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9'],
];

export function HighlightToolbar({ position, onHighlight, onFormat, onInsertImage, className }) {
    const [showTextColors, setShowTextColors] = useState(false);
    const [showFontSizes, setShowFontSizes] = useState(false);
    const [showLineHeight, setShowLineHeight] = useState(false);
    const [showParagraphSpacing, setShowParagraphSpacing] = useState(false);
    const [showMermaidTheme, setShowMermaidTheme] = useState(false);
    const [customTextColors, setCustomTextColors] = useState(() => loadCustomColors(CUSTOM_TEXT_COLORS_KEY));
    const [customHighlightColors, setCustomHighlightColors] = useState(() => loadCustomColors(CUSTOM_HIGHLIGHT_COLORS_KEY));
    const [showTablePicker, setShowTablePicker] = useState(false);
    const [tableHover, setTableHover] = useState({ rows: 0, cols: 0 });
    const [showHighlightPicker, setShowHighlightPicker] = useState(false);

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

    const handleAddCustomTextColor = () => {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = '#000000';
        input.addEventListener('change', (e) => {
            const newColor = e.target.value;
            if (!customTextColors.includes(newColor)) {
                const updatedColors = [...customTextColors, newColor].slice(-10); // Keep last 10
                setCustomTextColors(updatedColors);
                saveCustomColors(CUSTOM_TEXT_COLORS_KEY, updatedColors);
            }
            onFormat('foreColor', newColor);
            setShowTextColors(false);
        });
        input.click();
    };

    const handleAddCustomHighlightColor = () => {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = '#fef08a';
        input.addEventListener('change', (e) => {
            const newColor = e.target.value;
            if (!customHighlightColors.includes(newColor)) {
                const updatedColors = [...customHighlightColors, newColor].slice(-10); // Keep last 10
                setCustomHighlightColors(updatedColors);
                saveCustomColors(CUSTOM_HIGHLIGHT_COLORS_KEY, updatedColors);
            }
            onHighlight(newColor);
            setShowHighlightPicker(false);
        });
        input.click();
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
                    <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 min-w-[240px]">
                        {/* Quick access colors */}
                        <div className="flex flex-wrap gap-1 mb-2 pb-2 border-b border-gray-200">
                            {QUICK_TEXT_COLORS.map((color) => (
                                <button
                                    key={color.id}
                                    onMouseDown={handleMouseDown}
                                    onClick={() => {
                                        onFormat('foreColor', color.value);
                                        setShowTextColors(false);
                                    }}
                                    className="w-5 h-5 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                                    style={{ backgroundColor: color.value }}
                                    title={color.label}
                                />
                            ))}
                        </div>

                        {/* Extended color palette grid */}
                        <div className="flex flex-col gap-0.5">
                            {COLOR_PALETTE.map((row, rowIndex) => (
                                <div key={rowIndex} className="flex gap-0.5">
                                    {row.map((color, colIndex) => (
                                        <button
                                            key={`${rowIndex}-${colIndex}`}
                                            onMouseDown={handleMouseDown}
                                            onClick={() => {
                                                onFormat('foreColor', color);
                                                setShowTextColors(false);
                                            }}
                                            className={cn(
                                                "w-5 h-5 rounded-sm hover:scale-110 transition-transform hover:z-10",
                                                color === '#ffffff' && "border border-gray-300"
                                            )}
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>

                        {/* Custom colors section */}
                        <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="text-xs text-gray-500 mb-1.5">CUSTOM</div>
                            <div className="flex items-center gap-1 flex-wrap">
                                {customTextColors.map((color, index) => (
                                    <button
                                        key={index}
                                        onMouseDown={handleMouseDown}
                                        onClick={() => {
                                            onFormat('foreColor', color);
                                            setShowTextColors(false);
                                        }}
                                        className="w-5 h-5 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                                        style={{ backgroundColor: color }}
                                        title={color}
                                    />
                                ))}
                                <button
                                    onMouseDown={handleMouseDown}
                                    onClick={handleAddCustomTextColor}
                                    className="w-5 h-5 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                                    title="Añadir color personalizado"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 5v14M5 12h14" />
                                    </svg>
                                </button>
                            </div>
                        </div>
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
                <div className="relative">
                    <button
                        onMouseDown={handleMouseDown}
                        onClick={() => setShowLineHeight(!showLineHeight)}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-700"
                        title="Interlineado"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 3h18" /><path d="M3 12h18" /><path d="M3 21h18" /><path d="M21 3v18" /><path d="M21 21l-4-4" /><path d="M21 3l-4 4" />
                        </svg>
                    </button>
                    {showLineHeight && (
                        <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[100px]">
                            {[1.0, 1.15, 1.5, 2.0].map(val => (
                                <button
                                    key={val}
                                    onMouseDown={handleMouseDown}
                                    onClick={() => {
                                        onFormat('lineHeight', val);
                                        setShowLineHeight(false);
                                    }}
                                    className="w-full px-3 py-1.5 text-left hover:bg-gray-100 text-sm"
                                >
                                    {val}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Paragraph Spacing */}
                <div className="relative">
                    <button
                        onMouseDown={handleMouseDown}
                        onClick={() => setShowParagraphSpacing(!showParagraphSpacing)}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-700"
                        title="Espaciado de párrafo"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10h-18" /><path d="M21 6h-18" /><path d="M21 14h-18" /><path d="M21 18h-18" />
                            <path d="M6 20v-2" /><path d="M6 4v2" />
                        </svg>
                    </button>
                    {showParagraphSpacing && (
                        <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[160px]">
                            <button
                                onMouseDown={handleMouseDown}
                                onClick={() => {
                                    onFormat('paragraphSpacing', 'add-before');
                                    setShowParagraphSpacing(false);
                                }}
                                className="w-full px-3 py-1.5 text-left hover:bg-gray-100 text-sm"
                            >
                                Añadir espacio antes
                            </button>
                            <button
                                onMouseDown={handleMouseDown}
                                onClick={() => {
                                    onFormat('paragraphSpacing', 'remove-before');
                                    setShowParagraphSpacing(false);
                                }}
                                className="w-full px-3 py-1.5 text-left hover:bg-gray-100 text-sm"
                            >
                                Quitar espacio antes
                            </button>
                            <button
                                onMouseDown={handleMouseDown}
                                onClick={() => {
                                    onFormat('paragraphSpacing', 'add-after');
                                    setShowParagraphSpacing(false);
                                }}
                                className="w-full px-3 py-1.5 text-left hover:bg-gray-100 text-sm"
                            >
                                Añadir espacio después
                            </button>
                            <button
                                onMouseDown={handleMouseDown}
                                onClick={() => {
                                    onFormat('paragraphSpacing', 'remove-after');
                                    setShowParagraphSpacing(false);
                                }}
                                className="w-full px-3 py-1.5 text-left hover:bg-gray-100 text-sm"
                            >
                                Quitar espacio después
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <Divider />

            {/* Insert Image */}
            {onInsertImage && (
                <>
                    <ToolButton onClick={onInsertImage} icon={Image} title="Insertar imagen" />
                </>
            )}

            {/* Insert Table */}
            <div className="relative">
                <button
                    onMouseDown={handleMouseDown}
                    onClick={() => setShowTablePicker(!showTablePicker)}
                    className="p-1.5 hover:bg-gray-100 rounded text-gray-700"
                    title="Insertar tabla"
                >
                    <Table size={18} />
                </button>
                {showTablePicker && (
                    <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50">
                        <div className="text-xs text-gray-500 mb-2 text-center">
                            {tableHover.rows > 0 && tableHover.cols > 0
                                ? `${tableHover.rows} × ${tableHover.cols}`
                                : 'Seleccionar tamaño'}
                        </div>
                        <div
                            className="grid gap-1"
                            style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}
                            onMouseLeave={() => setTableHover({ rows: 0, cols: 0 })}
                        >
                            {Array.from({ length: 8 }, (_, rowIndex) =>
                                Array.from({ length: 8 }, (_, colIndex) => (
                                    <button
                                        key={`${rowIndex}-${colIndex}`}
                                        onMouseDown={handleMouseDown}
                                        onMouseEnter={() => setTableHover({ rows: rowIndex + 1, cols: colIndex + 1 })}
                                        onClick={() => {
                                            onFormat('insertTable', { rows: rowIndex + 1, cols: colIndex + 1 });
                                            setShowTablePicker(false);
                                            setTableHover({ rows: 0, cols: 0 });
                                        }}
                                        className={cn(
                                            "w-4 h-4 border rounded-sm transition-colors",
                                            rowIndex < tableHover.rows && colIndex < tableHover.cols
                                                ? "bg-blue-500 border-blue-600"
                                                : "bg-gray-100 border-gray-300 hover:border-gray-400"
                                        )}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
            <Divider />

            {/* Mermaid Controls */}
            <div className="flex items-center gap-1">
                <div className="relative">
                    <button
                        onMouseDown={handleMouseDown}
                        onClick={() => setShowMermaidTheme(!showMermaidTheme)}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-700 font-mono text-xs font-bold"
                        title="Tema Mermaid"
                    >
                        M
                    </button>
                    {showMermaidTheme && (
                        <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[120px]">
                            {['default', 'neutral', 'dark', 'forest'].map(theme => (
                                <button
                                    key={theme}
                                    onMouseDown={handleMouseDown}
                                    onClick={() => {
                                        onFormat('mermaidTheme', theme);
                                        setShowMermaidTheme(false);
                                    }}
                                    className="w-full px-3 py-1.5 text-left hover:bg-gray-100 text-sm capitalize"
                                >
                                    {theme}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <Divider />

            {/* Highlight Colors */}
            <div className="flex items-center gap-1">
                {/* Quick access highlight colors */}
                {HIGHLIGHT_COLORS.slice(0, 5).map((color) => (
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

                {/* Extended highlight color picker */}
                <div className="relative">
                    <button
                        onMouseDown={handleMouseDown}
                        onClick={() => setShowHighlightPicker(!showHighlightPicker)}
                        className="w-6 h-6 rounded-full border border-gray-300 hover:scale-110 transition-transform flex items-center justify-center bg-gradient-to-br from-yellow-200 via-pink-200 to-blue-200"
                        title="Más colores de resaltado"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 9l6 6 6-6" />
                        </svg>
                    </button>
                    {showHighlightPicker && (
                        <div className="absolute bottom-full mb-1 right-0 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 min-w-[240px]">
                            {/* Quick access colors */}
                            <div className="flex flex-wrap gap-1 mb-2 pb-2 border-b border-gray-200">
                                {HIGHLIGHT_COLORS.map((color) => (
                                    <button
                                        key={color.id}
                                        onMouseDown={handleMouseDown}
                                        onClick={() => {
                                            onHighlight(color.value);
                                            setShowHighlightPicker(false);
                                        }}
                                        className="w-5 h-5 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                                        style={{ backgroundColor: color.value }}
                                        title={color.label}
                                    />
                                ))}
                            </div>

                            {/* Extended highlight palette grid */}
                            <div className="flex flex-col gap-0.5">
                                {HIGHLIGHT_PALETTE.map((row, rowIndex) => (
                                    <div key={rowIndex} className="flex gap-0.5">
                                        {row.map((color, colIndex) => (
                                            <button
                                                key={`${rowIndex}-${colIndex}`}
                                                onMouseDown={handleMouseDown}
                                                onClick={() => {
                                                    onHighlight(color);
                                                    setShowHighlightPicker(false);
                                                }}
                                                className="w-5 h-5 rounded-sm hover:scale-110 transition-transform hover:z-10 border border-gray-200"
                                                style={{ backgroundColor: color }}
                                                title={color}
                                            />
                                        ))}
                                    </div>
                                ))}
                            </div>

                            {/* Custom highlight colors section */}
                            <div className="mt-2 pt-2 border-t border-gray-200">
                                <div className="text-xs text-gray-500 mb-1.5">CUSTOM</div>
                                <div className="flex items-center gap-1 flex-wrap">
                                    {customHighlightColors.map((color, index) => (
                                        <button
                                            key={index}
                                            onMouseDown={handleMouseDown}
                                            onClick={() => {
                                                onHighlight(color);
                                                setShowHighlightPicker(false);
                                            }}
                                            className="w-5 h-5 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        />
                                    ))}
                                    <button
                                        onMouseDown={handleMouseDown}
                                        onClick={handleAddCustomHighlightColor}
                                        className="w-5 h-5 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                                        title="Añadir color personalizado"
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M12 5v14M5 12h14" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
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
