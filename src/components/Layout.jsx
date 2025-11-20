import React from 'react';
import { cn } from '../lib/utils';

export function Layout({ children, className }) {
    return (
        <div className={cn("min-h-screen bg-gray-50 text-gray-900 font-sans", className)}>
            <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                {children}
            </main>
        </div>
    );
}
