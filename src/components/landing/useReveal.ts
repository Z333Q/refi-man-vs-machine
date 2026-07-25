import { useEffect, useRef, useState } from 'react';

/**
 * Reveal-on-scroll. Returns a ref + `shown`, flipping true when the element
 * scrolls into view. Respects prefers-reduced-motion (shows immediately, no
 * animation) — accessibility per the ReFi Alpha spec §66.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, []);

  return { ref, shown };
}
