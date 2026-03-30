import { useCallback, useRef, useState } from "react";

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

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const ref = touchRef.current;
    if (!ref) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - ref.startX;
    const deltaY = touch.clientY - ref.startY;

    // If not yet locked into a direction, check which axis dominates
    if (!ref.locked) {
      // Need minimum movement before deciding direction
      if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;
      // Horizontal scroll — abort swipe tracking
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        touchRef.current = null;
        setSwipingTileId(null);
        setSwipeOffset(0);
        return;
      }
      ref.locked = true;
    }

    // Only track upward movement (negative deltaY)
    if (deltaY < 0) {
      setSwipingTileId(ref.tileId);
      setSwipeOffset(deltaY);
    } else {
      setSwipeOffset(0);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    const ref = touchRef.current;
    const threshold = thresholdProp ?? Math.min(40, window.innerHeight * 0.08);
    if (ref && ref.locked && swipeOffset < -threshold) {
      onSwipeUp(ref.tileId);
    }
    touchRef.current = null;
    setSwipingTileId(null);
    setSwipeOffset(0);
  }, [swipeOffset, thresholdProp, onSwipeUp]);

  return { onTouchStart, onTouchMove, onTouchEnd, swipingTileId, swipeOffset };
}
