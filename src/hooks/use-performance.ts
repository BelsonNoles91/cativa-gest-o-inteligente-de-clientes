
import { useEffect, useRef, useState } from "react";

/**
 * Hook para debouncing de valores de entrada (útil para buscas e filtros).
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// import duplicado removido

/**
 * Hook para monitorar re-renders durante desenvolvimento.
 */
export function useRenderLog(name: string) {
  if (import.meta.env.DEV) {
    const count = useRef(0);
    useEffect(() => {
      count.current++;
      console.log(`[Perf] ${name} render count: ${count.current}`);
    });
  }
}

/**
 * Abstração para interseção (Lazy Loading de imagens/listas).
 */
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, options]);

  return isIntersecting;
}
