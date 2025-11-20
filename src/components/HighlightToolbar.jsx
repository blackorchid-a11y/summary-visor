import React from 'react';
import { Bold, Italic, Underline, Eraser } from 'lucide-react';
import { cn } from '../lib/utils';

const COLORS = [
    { id: 'yellow', value: '#fef08a', label: 'Amarillo' },
    { id: 'green', value: '#bbf7d0', label: 'Verde' },
    { id: 'blue', value: '#bfdbfe', label: 'Azul' },
    { id: 'pink', value: '#fbcfe8', label: 'Rosa' },
    { id: 'orange', value: '#fed7aa', label: 'Naranja' },
];

export function HighlightToolbar({ position, onHighlight, onFormat, className }) {
    // If position is null, we render as a static/sticky toolbar
    // If position is provided, we render as a floating toolbar

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

    return (
        <div
            className={cn(
                "flex items-center gap-1 p-1.5 bg-white rounded-lg shadow-md border border-gray-200 transition-all",
                position ? "animate-in fade-in zoom-in duration-200" : "w-full max-w-fit mx-auto mb-4 sticky top-20 z-40",
                className
            )}
            style={style}
        >
            <div className="flex items-center gap-1 border-r border-gray-200 pr-2 mr-2">
                <button onMouseDown={handleMouseDown} onClick={() => onFormat('bold')} className="p-1.5 hover:bg-gray-100 rounded text-gray-700" title="Negrita">
                    <Bold size={18} />
                </button>
                <button onMouseDown={handleMouseDown} onClick={() => onFormat('italic')} className="p-1.5 hover:bg-gray-100 rounded text-gray-700" title="Cursiva">
                    <Italic size={18} />
                </button>
                <button onMouseDown={handleMouseDown} onClick={() => onFormat('underline')} className="p-1.5 hover:bg-gray-100 rounded text-gray-700" title="Subrayado">
                    <Underline size={18} />
                </button>
            </div>

            <div className="flex items-center gap-1">
                {COLORS.map((color) => (
                    <button
                        key={color.id}
                        onMouseDown={handleMouseDown}
                        onClick={(e) => {
                            e.stopPropagation();
                            onHighlight(color.value);
                        }}
                        className="w-6 h-6 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                        style={{ backgroundColor: color.value }}
                        title={color.label}
                    />
                ))}
            </div>

            <div className="w-px h-5 bg-gray-200 mx-2" />

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

