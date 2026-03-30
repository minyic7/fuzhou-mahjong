import { useState, useEffect } from "react";

const COMPACT_HEIGHT_BREAKPOINT = 500;

export function useIsCompactLandscape(): boolean {
  const [isCompact, setIsCompact] = useState(() => window.innerHeight <= COMPACT_HEIGHT_BREAKPOINT);

  useEffect(() => {
    const onResize = () => setIsCompact(window.innerHeight <= COMPACT_HEIGHT_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isCompact;
}
