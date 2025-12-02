import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Custom hook for pinch-to-zoom functionality on a specific element.
 * This replaces native WebView zoom to prevent iOS rotation bugs.
 * 
 * Features:
 * - Pinch to zoom (2 finger gesture)
 * - Double-tap to zoom in/out
 * - Pan when zoomed in (1 finger drag)
 * - Auto-reset on orientation change
 * - Allows normal scrolling when not zoomed
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.minScale - Minimum zoom level (default: 1)
 * @param {number} options.maxScale - Maximum zoom level (default: 3)
 * @param {number} options.initialScale - Initial zoom level (default: 1)
 * @param {boolean} options.doubleTapToZoom - Enable double-tap zoom (default: true)
 * @returns {Object} - { containerRef, contentRef, scale, resetZoom, isZoomed }
 */
export function usePinchZoom({
    minScale = 1,
    maxScale = 3,
    initialScale = 1,
    doubleTapToZoom = true,
} = {}) {
    const containerRef = useRef(null);
    const contentRef = useRef(null);
    const [scale, setScale] = useState(initialScale);
    
    // Refs for gesture tracking
    const gestureState = useRef({
        isZooming: false,
        isPanning: false,
        initialDistance: 0,
        initialScale: 1,
        lastTap: 0,
        lastTapX: 0,
        lastTapY: 0,
        // For pan during zoom
        startX: 0,
        startY: 0,
        translateX: 0,
        translateY: 0,
        currentTranslateX: 0,
        currentTranslateY: 0,
        currentScale: 1,
    });

    const resetZoom = useCallback(() => {
        setScale(1);
        gestureState.current.translateX = 0;
        gestureState.current.translateY = 0;
        gestureState.current.currentTranslateX = 0;
        gestureState.current.currentTranslateY = 0;
        gestureState.current.currentScale = 1;
        
        if (contentRef.current) {
            contentRef.current.style.transform = 'scale(1) translate(0px, 0px)';
            contentRef.current.style.transition = 'transform 0.2s ease-out';
            // Remove transition after animation
            setTimeout(() => {
                if (contentRef.current) {
                    contentRef.current.style.transition = '';
                }
            }, 200);
        }
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        const content = contentRef.current;
        if (!container || !content) return;

        // Calculate distance between two touch points
        const getDistance = (touches) => {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        // Get center point between two touches
        const getCenter = (touches) => {
            return {
                x: (touches[0].clientX + touches[1].clientX) / 2,
                y: (touches[0].clientY + touches[1].clientY) / 2,
            };
        };

        // Apply transform to content
        const applyTransform = (newScale, translateX = 0, translateY = 0, animate = false) => {
            const clampedScale = Math.min(Math.max(newScale, minScale), maxScale);
            
            // Calculate bounds for translation based on content size
            const contentRect = content.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            
            // Calculate max translation (content can move half its scaled overflow)
            const scaledWidth = containerRect.width * clampedScale;
            const scaledHeight = contentRect.height * clampedScale;
            const maxTranslateX = Math.max(0, (scaledWidth - containerRect.width) / 2);
            const maxTranslateY = Math.max(0, (scaledHeight - containerRect.height) / 2);
            
            const clampedTranslateX = Math.min(Math.max(translateX, -maxTranslateX), maxTranslateX);
            const clampedTranslateY = Math.min(Math.max(translateY, -maxTranslateY), maxTranslateY);
            
            gestureState.current.currentTranslateX = clampedTranslateX;
            gestureState.current.currentTranslateY = clampedTranslateY;
            gestureState.current.currentScale = clampedScale;
            
            if (animate) {
                content.style.transition = 'transform 0.2s ease-out';
                setTimeout(() => {
                    content.style.transition = '';
                }, 200);
            } else {
                content.style.transition = '';
            }
            
            content.style.transform = `scale(${clampedScale}) translate(${clampedTranslateX / clampedScale}px, ${clampedTranslateY / clampedScale}px)`;
            content.style.transformOrigin = 'center top';
            
            setScale(clampedScale);
            return clampedScale;
        };

        // Touch start handler
        const handleTouchStart = (e) => {
            const currentScale = gestureState.current.currentScale;
            
            if (e.touches.length === 2) {
                // Pinch zoom start - always prevent default for 2 finger gestures
                e.preventDefault();
                gestureState.current.isZooming = true;
                gestureState.current.isPanning = false;
                gestureState.current.initialDistance = getDistance(e.touches);
                gestureState.current.initialScale = currentScale;
                gestureState.current.translateX = gestureState.current.currentTranslateX;
                gestureState.current.translateY = gestureState.current.currentTranslateY;
                
                const center = getCenter(e.touches);
                gestureState.current.startX = center.x;
                gestureState.current.startY = center.y;
            } else if (e.touches.length === 1) {
                // Single finger - check for double tap or pan
                const now = Date.now();
                const touch = e.touches[0];
                const timeSinceLastTap = now - gestureState.current.lastTap;
                const distanceFromLastTap = Math.sqrt(
                    Math.pow(touch.clientX - gestureState.current.lastTapX, 2) +
                    Math.pow(touch.clientY - gestureState.current.lastTapY, 2)
                );
                
                // Double tap detection (within 300ms and 50px of last tap)
                if (doubleTapToZoom && timeSinceLastTap < 300 && timeSinceLastTap > 0 && distanceFromLastTap < 50) {
                    e.preventDefault();
                    gestureState.current.lastTap = 0; // Reset to prevent triple-tap
                    
                    if (currentScale > 1.1) {
                        // Zoom out to 1
                        resetZoom();
                    } else {
                        // Zoom in to 2x at tap location
                        const rect = container.getBoundingClientRect();
                        const tapX = touch.clientX - rect.left;
                        const tapY = touch.clientY - rect.top;
                        
                        // Calculate offset to center zoom on tap point
                        const centerX = rect.width / 2;
                        const centerY = rect.height / 2;
                        const offsetX = (centerX - tapX) * 0.5;
                        const offsetY = (centerY - tapY) * 0.5;
                        
                        applyTransform(2, offsetX, offsetY, true);
                    }
                } else {
                    // Store tap info for double-tap detection
                    gestureState.current.lastTap = now;
                    gestureState.current.lastTapX = touch.clientX;
                    gestureState.current.lastTapY = touch.clientY;
                    
                    // If zoomed in, prepare for pan
                    if (currentScale > 1) {
                        gestureState.current.isPanning = true;
                        gestureState.current.startX = touch.clientX;
                        gestureState.current.startY = touch.clientY;
                        gestureState.current.translateX = gestureState.current.currentTranslateX;
                        gestureState.current.translateY = gestureState.current.currentTranslateY;
                    }
                }
            }
        };

        // Touch move handler
        const handleTouchMove = (e) => {
            const currentScale = gestureState.current.currentScale;
            
            if (e.touches.length === 2 && gestureState.current.isZooming) {
                // Pinch zoom
                e.preventDefault();
                const currentDistance = getDistance(e.touches);
                const scaleChange = currentDistance / gestureState.current.initialDistance;
                const newScale = gestureState.current.initialScale * scaleChange;
                
                // Calculate pan offset during zoom
                const center = getCenter(e.touches);
                const deltaX = center.x - gestureState.current.startX;
                const deltaY = center.y - gestureState.current.startY;
                
                applyTransform(
                    newScale,
                    gestureState.current.translateX + deltaX,
                    gestureState.current.translateY + deltaY
                );
            } else if (e.touches.length === 1 && currentScale > 1 && gestureState.current.isPanning) {
                // Pan while zoomed - prevent default only when panning
                e.preventDefault();
                const deltaX = e.touches[0].clientX - gestureState.current.startX;
                const deltaY = e.touches[0].clientY - gestureState.current.startY;
                
                applyTransform(
                    currentScale,
                    gestureState.current.translateX + deltaX,
                    gestureState.current.translateY + deltaY
                );
            }
            // If not zoomed and single finger, let default scroll behavior happen
        };

        // Touch end handler
        const handleTouchEnd = (e) => {
            const currentScale = gestureState.current.currentScale;
            
            if (e.touches.length < 2) {
                gestureState.current.isZooming = false;
            }
            
            if (e.touches.length === 0) {
                gestureState.current.isPanning = false;
                
                // Snap to minScale if close enough
                if (currentScale < minScale + 0.15 && currentScale !== 1) {
                    resetZoom();
                }
            }
            
            // Update translate values for next gesture
            gestureState.current.translateX = gestureState.current.currentTranslateX;
            gestureState.current.translateY = gestureState.current.currentTranslateY;
        };

        // Add event listeners
        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd);
        container.addEventListener('touchcancel', handleTouchEnd);

        // Cleanup
        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            container.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [minScale, maxScale, doubleTapToZoom, resetZoom]);

    // Reset zoom on orientation change
    useEffect(() => {
        const handleOrientationChange = () => {
            // Small delay to let the browser finish orientation change
            setTimeout(() => {
                resetZoom();
            }, 100);
        };

        window.addEventListener('orientationchange', handleOrientationChange);
        
        // Also track resize for orientation changes that don't fire orientationchange
        let lastWidth = window.innerWidth;
        let lastHeight = window.innerHeight;
        
        const handleResize = () => {
            const widthChanged = Math.abs(window.innerWidth - lastWidth) > 100;
            const heightChanged = Math.abs(window.innerHeight - lastHeight) > 100;
            
            // If both dimensions changed significantly, likely an orientation change
            if (widthChanged && heightChanged) {
                handleOrientationChange();
            }
            
            lastWidth = window.innerWidth;
            lastHeight = window.innerHeight;
        };
        
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('orientationchange', handleOrientationChange);
            window.removeEventListener('resize', handleResize);
        };
    }, [resetZoom]);

    return {
        containerRef,
        contentRef,
        scale,
        resetZoom,
        isZoomed: scale > 1,
    };
}
