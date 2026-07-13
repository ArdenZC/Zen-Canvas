import { useEffect, useState } from "react";

export function useMediaQuery(query: string) {
  const read = () => typeof window !== "undefined"
    && (window.matchMedia?.(query).matches ?? window.innerWidth <= 1100);
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia?.(query);
    const update = (event?: MediaQueryListEvent) => setMatches(event?.matches ?? media?.matches ?? window.innerWidth <= 1100);
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
