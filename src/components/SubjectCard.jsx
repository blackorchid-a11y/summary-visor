import React from 'react';
import { cn } from '../lib/utils';

export function SubjectCard({ subject, onClick }) {
    return (
        <button
            onClick={onClick}
            className="flex flex-col items-center justify-center p-8 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 bg-white border border-gray-100 group"
            style={{ borderTop: `4px solid ${subject.color}` }}
        >
            <h3 className="text-xl font-bold text-gray-800 group-hover:text-gray-900">
                {subject.name}
            </h3>
            <span className="mt-2 text-sm text-gray-500">Ver temas</span>
        </button>
    );
}
