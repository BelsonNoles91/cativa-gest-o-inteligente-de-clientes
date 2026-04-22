/**
 * useShortViewport — retorna true quando a altura da viewport é menor que o
 * limite informado (default 800px). Usado para ativar modo compacto de cards
 * em laptops 1366×768 e telas similares.
 */
import { useEffect, useState } from "react";

export function useShortViewport(threshold = 800): boolean {
  const [isShort, setIsShort] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerHeight < threshold;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setIsShort(window.innerHeight < threshold);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [threshold]);

  return isShort;
}
