import { useCallback, useEffect, useRef, useState } from "react";

interface SwipeConfig {
  onSwipeUp: (tileId: number) => void;
  threshold?: number;
  enabled?: boolean;
}

/**
 * Manages swipe-up gesture state for a set of tiles.
 * Only one tile can be swiped at a time.
 * Returns handler factories and the current swipe state.
 */
export function useSwipeGesture({
  onSwipeUp,
  threshold: thresholdProp,
  enabled = true,
}: SwipeConfig) {
  const [swipingTileId, setSwipingTileId] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchRef = useRef<{ startX: number; startY: number; tileId: number; locked: boolean } | null>(null);

  const onTouchStart = useCallback(
    (tileId: number, e: React.TouchEvent) => {
      if (!enabled) return;
      const touch = e.touches[0];
      touchRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        tileId,
        locked: false,
      };
    },
    [enabled],
  );

  // Ref to the container element so we can attach a non-passive touchmove listener
  const containerRef = useRef<HTMLElement | null>(null);

  // Native touchmove handler — must be non-passive so preventDefault() works on iOS
  const handleTouchMove = useCallback((e: TouchEvent) => {
    const ref = touchRef.current;
    if (!ref) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - ref.startX;
    const deltaY = touch.clientY - ref.startY;

    // If not yet locked into a direction, check which axis dominates
    if (!ref.locked) {
      // Need minimum movement before deciding direction
      const deadzone = Math.max(6, window.innerHeight * 0.02);
      if (Math.abs(deltaX) < deadzone && Math.abs(deltaY) < deadzone) return;
      // Horizontal scroll — abort swipe tracking
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        touchRef.current = null;
        setSwipingTileId(null);
        setSwipeOffset(0);
        return;
      }
      ref.locked = true;
    }

    // Prevent iOS scroll while actively swiping
    e.preventDefault();

    // Only track upward movement (negative deltaY)
    if (deltaY < 0) {
      setSwipingTileId(ref.tileId);
      setSwipeOffset(deltaY);
    } else {
      setSwipeOffset(0);
    }
  }, []);

  // Attach touchmove via addEventListener with { passive: false }
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", handleTouchMove);
  }, [handleTouchMove]);

  const onTouchEnd = useCallback(() => {
    const ref = touchRef.current;
    const threshold = thresholdProp ?? Math.max(25, window.innerHeight * 0.08);
    if (ref && ref.locked && swipeOffset < -threshold) {
      onSwipeUp(ref.tileId);
    }
    touchRef.current = null;
    setSwipingTileId(null);
    setSwipeOffset(0);
  }, [swipeOffset, thresholdProp, onSwipeUp]);

  const onTouchCancel = useCallback(() => {
    touchRef.current = null;
    setSwipingTileId(null);
    setSwipeOffset(0);
  }, []);

  return { onTouchStart, containerRef, onTouchEnd, onTouchCancel, swipingTileId, swipeOffset };
}
