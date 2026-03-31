import { useMemo } from "react";

/**
 * Detect mobile device by user-agent and touch capability (not viewport size).
 * Value is computed once and memoized — devices don't change mid-session.
 */
export function useIsMobileDevice(): boolean {
  return useMemo(() => {
    const userAgentMatch = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
    const hasTouchAndCoarsePointer =
      navigator.maxTouchPoints > 0 ||
      window.matchMedia("(pointer: coarse)").matches;
    return userAgentMatch || hasTouchAndCoarsePointer;
  }, []);
}
