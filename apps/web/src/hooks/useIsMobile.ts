import { useState, useEffect } from "react";

export const BREAKPOINTS = {
  COMPACT_HEIGHT: 550,
  SMALL_PHONE_HEIGHT: 390,
  TABLET_WIDTH: 768,
  PHONE_WIDTH: 480,
  TINY_WIDTH: 360,
} as const;

const COMPACT_LANDSCAPE_MQ = `(orientation: landscape) and (max-height: ${BREAKPOINTS.COMPACT_HEIGHT}px)`;

export function useIsCompactLandscape(): boolean {
  const [isCompact, setIsCompact] = useState(() => window.matchMedia(COMPACT_LANDSCAPE_MQ).matches);

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_LANDSCAPE_MQ);
    const handler = (e: MediaQueryListEvent) => setIsCompact(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
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
