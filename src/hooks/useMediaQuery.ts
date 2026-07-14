import { useEffect, useState } from "react";

function fallbackMatches(query: string) {
  const width = typeof window === "undefined" ? 0 : window.innerWidth;
  const maxWidth = query.match(/max-width\s*:\s*(\d+)px/i)?.[1];
  const minWidth = query.match(/min-width\s*:\s*(\d+)px/i)?.[1];
  return (!maxWidth || width <= Number(maxWidth)) && (!minWidth || width >= Number(minWidth));
}

export function useMediaQuery(query: string) {
  const read = () => typeof window !== "undefined"
    && (window.matchMedia?.(query).matches ?? fallbackMatches(query));
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia?.(query);
    const update = (event?: MediaQueryListEvent) => setMatches(event?.matches ?? media?.matches ?? fallbackMatches(query));
    update();
    if (media) media.addEventListener("change", update);
    else window.addEventListener("resize", update as EventListener);
    return () => {
      if (media) media.removeEventListener("change", update);
      else window.removeEventListener("resize", update as EventListener);
    };
  }, [query]);
  return matches;
}
