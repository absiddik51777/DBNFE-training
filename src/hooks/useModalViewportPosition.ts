import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Calculates viewport height and modal height to dynamically determine whether
 * a modal should be vertically centered (center-center) or aligned to the top (top-center).
 *
 * Requirements addressed:
 * 1. Position: top center (prevent cutting off on mobile and tall modals)
 * 2. Calculate viewport height vs modal height dynamically (with window resize & content observer)
 * 3. Enable smooth scrolling for long modals
 */
export function useModalViewportPosition<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean = true,
  options: {
    mobileBreakpoint?: number;
    marginThreshold?: number;
  } = {}
) {
  const { mobileBreakpoint = 640, marginThreshold = 60 } = options;
  const modalRef = useRef<T | null>(null);
  const [positionMode, setPositionMode] = useState<'top' | 'center'>('top');
  const [isLongModal, setIsLongModal] = useState(false);

  const calculatePosition = useCallback(() => {
    if (typeof window === 'undefined') return;

    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth;

    // Mobile screens always use top-center to ensure headers and bottom actions never get clipped
    if (vw < mobileBreakpoint) {
      setPositionMode('top');
      setIsLongModal(true);
      return;
    }

    const modalEl = modalRef.current;
    if (!modalEl) {
      setPositionMode('top');
      return;
    }

    const modalHeight = modalEl.scrollHeight || modalEl.offsetHeight;
    const fitsInCenter = modalHeight + marginThreshold < vh;

    setIsLongModal(modalHeight + 24 >= vh);

    if (fitsInCenter) {
      setPositionMode('center');
    } else {
      setPositionMode('top');
    }
  }, [mobileBreakpoint, marginThreshold]);

  useEffect(() => {
    if (!isOpen) return;

    // Immediate calculation
    calculatePosition();

    // Trigger re-calculation after DOM paint and asset rendering
    const timer1 = setTimeout(calculatePosition, 60);
    const timer2 = setTimeout(calculatePosition, 250);

    const handleResize = () => {
      calculatePosition();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && modalRef.current) {
      observer = new ResizeObserver(() => {
        calculatePosition();
      });
      observer.observe(modalRef.current);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [isOpen, calculatePosition]);

  return {
    modalRef,
    positionMode, // 'top' | 'center'
    isLongModal,
    recalculate: calculatePosition,
    backdropClasses: "fixed inset-0 z-50 overflow-y-auto overflow-x-hidden bg-slate-900/60 backdrop-blur-xs overscroll-contain",
    alignmentClasses: positionMode === 'top' 
      ? "min-h-full w-full flex items-start justify-center p-3 sm:p-5 pt-3 sm:pt-6 pb-16" 
      : "min-h-full w-full flex items-center justify-center p-3 sm:p-5 py-6"
  };
}

export default useModalViewportPosition;
