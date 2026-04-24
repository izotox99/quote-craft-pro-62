import { useEffect, useRef } from "react";

/**
 * Permette di scorrere orizzontalmente una tabella larga usando la rotella
 * verticale del mouse (utile su MacBook senza scrollbar visibile).
 * Se l'utente sta già scorrendo orizzontalmente (trackpad due dita),
 * il browser gestisce nativamente.
 */
export function useHorizontalWheel<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // Se il delta orizzontale è dominante, lascia fare al browser
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      // Se non c'è overflow orizzontale, non bloccare lo scroll della pagina
      if (el.scrollWidth <= el.clientWidth) return;

      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return ref;
}
