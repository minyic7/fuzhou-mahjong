import { useState, useEffect } from "react";

export const BREAKPOINTS = {
  COMPACT_HEIGHT: 550,
  SMALL_PHONE_HEIGHT: 390,
  TABLET_WIDTH: 768,
  PHONE_WIDTH: 480,
  TINY_WIDTH: 360,
  FIRST_PERSON_WIDTH_THRESHOLD: 1024,
} as const;

export function useIsCompactLandscape(): boolean {
  const [isCompact, setIsCompact] = useState(() => window.innerHeight <= BREAKPOINTS.COMPACT_HEIGHT);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setIsCompact(window.innerHeight <= BREAKPOINTS.COMPACT_HEIGHT);
      }, 100);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return isCompact;
}

export function useIsFirstPersonMobile(): boolean {
  const [isFP, setIsFP] = useState(
    () => window.innerHeight <= BREAKPOINTS.COMPACT_HEIGHT && window.innerWidth <= BREAKPOINTS.FIRST_PERSON_WIDTH_THRESHOLD
  );
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setIsFP(window.innerHeight <= BREAKPOINTS.COMPACT_HEIGHT && window.innerWidth <= BREAKPOINTS.FIRST_PERSON_WIDTH_THRESHOLD);
      }, 100);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", onResize);
    };
  }, []);
  return isFP;
}
