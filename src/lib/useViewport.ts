import { useEffect, useState } from 'react';

/**
 * Viewport autodetection for the mobile-first layouts.
 *
 * Breakpoints match the Tailwind scale used across the screens:
 *   mobile  < 640px      one column, action zone full width
 *   tablet  640–1023px   two columns, panels collapse into tabs
 *   desktop >= 1024px    full terminal layout
 *
 * `coarsePointer` distinguishes touch from mouse regardless of width, so the
 * dense hover-only affordances can be swapped for tap targets. `landscape`
 * drives the rotate notice on the screens that need the wide terminal.
 */

export type ViewportClass = 'mobile' | 'tablet' | 'desktop';

export interface Viewport {
  width: number;
  height: number;
  className: ViewportClass;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  landscape: boolean;
  coarsePointer: boolean;
  /** Too small AND portrait — the wide terminal cannot be read here. */
  needsRotate: boolean;
}

function read(): Viewport {
  const width = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const height = typeof window === 'undefined' ? 800 : window.innerHeight;
  const className: ViewportClass = width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
  const landscape = width >= height;
  const coarsePointer =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;

  return {
    width,
    height,
    className,
    isMobile: className === 'mobile',
    isTablet: className === 'tablet',
    isDesktop: className === 'desktop',
    landscape,
    coarsePointer,
    // Portrait phones and small portrait tablets cannot show the three-pane
    // run terminal without unreadable column widths.
    needsRotate: !landscape && width < 900,
  };
}

export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(read);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setVp(read()));
    };
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return vp;
}
