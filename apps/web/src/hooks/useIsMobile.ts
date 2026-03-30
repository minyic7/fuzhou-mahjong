import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 600;
const COMPACT_HEIGHT_BREAKPOINT = 500;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= MOBILE_BREAKPOINT);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isMobile;
}

export function useIsCompactLandscape(): boolean {
  const [isCompact, setIsCompact] = useState(() => window.innerHeight <= COMPACT_HEIGHT_BREAKPOINT);

  useEffect(() => {
    const onResize = () => setIsCompact(window.innerHeight <= COMPACT_HEIGHT_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isCompact;
}
