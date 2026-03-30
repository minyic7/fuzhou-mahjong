import { useState, useEffect } from "react";

export const BREAKPOINTS = {
  COMPACT_HEIGHT: 550,
  SMALL_PHONE_HEIGHT: 390,
  TABLET_WIDTH: 768,
  PHONE_WIDTH: 480,
  TINY_WIDTH: 360,
} as const;

export function useIsCompactLandscape(): boolean {
  const [isCompact, setIsCompact] = useState(() => window.innerHeight <= BREAKPOINTS.COMPACT_HEIGHT);

  useEffect(() => {
    const onResize = () => setIsCompact(window.innerHeight <= BREAKPOINTS.COMPACT_HEIGHT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isCompact;
}

export function useIsFirstPersonMobile(): boolean {
  const [isFP, setIsFP] = useState(
    () => window.innerHeight <= BREAKPOINTS.COMPACT_HEIGHT && window.innerWidth <= 1024
  );
  useEffect(() => {
    const onResize = () =>
      setIsFP(window.innerHeight <= BREAKPOINTS.COMPACT_HEIGHT && window.innerWidth <= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isFP;
}
