import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// Detect if running on iOS (iPhone/iPad)
export function isIOSDevice() {
    if (typeof window === 'undefined') return false;

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isIOSWebView = window.webkit?.messageHandlers !== undefined;

    // Also check for iPad on iOS 13+ which reports as MacIntel
    const isIPadOS = userAgent.includes('mac') && 'ontouchend' in document;

    return isIOS || isIOSWebView || isIPadOS;
}

// Detect if device is in landscape orientation
export function isLandscape() {
    if (typeof window === 'undefined') return false;
    return window.innerWidth > window.innerHeight;
}
