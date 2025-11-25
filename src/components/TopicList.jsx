import React from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';

export function TopicList({ subject, topics, onSelectTopic, onAddTopic, onDeleteTopic, onAddDemoTopic }) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">{subject.name}</h2>
                <button
                    onClick={onAddTopic}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus size={20} />
                    Añadir Tema
                </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {topics.map((topic) => (
                    <div
                        key={topic.id}
                        className="group relative flex flex-col p-6 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                        onClick={() => onSelectTopic(topic)}
                    >
                        <div className="flex items-start justify-between">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                                <FileText size={24} />
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteTopic(topic.id);
                                }}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-gray-900 line-clamp-2">
                            {topic.title}
                        </h3>
                        <p className="mt-2 text-sm text-gray-500">
                            {new Date(topic.lastModified).toLocaleDateString()}
                        </p>
                    </div>
                ))}
            </div>

            {topics.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                    <p className="text-gray-500">No hay temas todavía.</p>
                    <div className="flex flex-col items-center gap-3 mt-4">
                        <button
                            onClick={onAddTopic}
                            className="text-blue-600 font-medium hover:underline"
                        >
                            Añadir el primero
                        </button>
                        <span className="text-gray-400 text-sm">o</span>
                        <button
                            onClick={() => {
                                const demoTopic = {
                                    id: crypto.randomUUID(),
                                    subjectId: subject.id,
                                    title: 'Tema de Ejemplo: Anatomía Cardíaca',
                                    content: '<h1>Anatomía Cardíaca</h1><p>El corazón es un órgano muscular hueco...</p><h2>Cavidades</h2><ul><li>Aurícula Derecha</li><li>Ventrículo Derecho</li></ul>',
                                    lastModified: Date.now(),
                                };
                                if (window.confirm('¿Cargar un tema de ejemplo?')) {
                                    if (onAddDemoTopic) {
                                        onAddDemoTopic(demoTopic);
                                    }
                                }
                            }}
                            className="text-sm text-gray-500 hover:text-gray-700 bg-gray-50 px-3 py-1 rounded-full border border-gray-200"
                        >
                            Cargar tema de ejemplo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
