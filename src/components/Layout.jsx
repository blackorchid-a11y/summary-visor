import React from 'react';
import { cn } from '../lib/utils';

export function Layout({ children, className, fullScreen = false }) {
    return (
        <div className={cn("min-h-screen bg-white text-gray-900 font-sans", className)}>
            {fullScreen ? (
                children
            ) : (
                <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                    {children}
                </main>
            )}
        </div>
    );
}
