import React, { useEffect, useRef, useState } from 'react';

import { ArrowLeft } from 'lucide-react';
import { HighlightToolbar } from './HighlightToolbar';
import { saveTopic } from '../lib/db';
import mermaid from 'mermaid';

mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
});

export function TopicViewer({ topic, onBack }) {
    const contentRef = useRef(null);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [topic.id]);

    useEffect(() => {
        // Initialize mermaid diagrams
        if (contentRef.current) {
            const nodes = contentRef.current.querySelectorAll('.mermaid');
            if (nodes.length > 0) {
                mermaid.run({
                    nodes: nodes,
                }).catch(err => console.error('Mermaid error:', err));
            }
        }
    }, [topic.content]);

    const handleInput = async () => {
        const contentDiv = contentRef.current;
        if (!contentDiv) return;

        // Save changes on input (auto-save)
        const newContent = contentDiv.innerHTML;
        await saveTopic({ ...topic, content: newContent, lastModified: Date.now() });
    };

    const applyFormat = (command, value = null) => {
        document.execCommand(command, false, value);
        // Trigger save manually since execCommand might not trigger onInput in all browsers immediately
        handleInput();
    };

    const handleHighlight = (color) => {
        if (color) {
            applyFormat('hiliteColor', color);
        } else {
            applyFormat('removeFormat');
        }
    };

    const handleFormat = (type) => {
        applyFormat(type);
    };

    return (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-200 px-4 py-3 flex items-center gap-4 shadow-sm">
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

            <div className="max-w-4xl mx-auto p-8 sm:p-12">
                {/* Static Toolbar only */}
                <HighlightToolbar
                    onHighlight={handleHighlight}
                    onFormat={handleFormat}
                />

                <div
                    ref={contentRef}
                    contentEditable={true}
                    onInput={handleInput}
                    dangerouslySetInnerHTML={{ __html: topic.content }}
                    className="prose prose-blue max-w-none topic-content outline-none min-h-[50vh] leading-normal prose-p:my-1 prose-headings:my-2"
                />
            </div>
        </div>
    );
}
