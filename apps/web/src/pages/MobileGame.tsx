import { useEffect, useState } from "react";
import type { ClientGameState } from "@fuzhou-mahjong/shared";
import { BREAKPOINTS } from "../hooks/useIsMobile";
import { MobileGameTable } from "../components/MobileGameTable";

interface MobileGameProps {
  initialGameState?: ClientGameState | null;
  onLeave?: () => void;
}

export function MobileGame({ initialGameState, onLeave }: MobileGameProps) {
  // Lock orientation to landscape on mount; release on unmount
  useEffect(() => {
    const lockOrientation = async () => {
      try {
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (type: string) => Promise<void>;
          unlock?: () => void;
        };
        await orientation.lock?.("landscape");
      } catch {
        // Not supported or not allowed — CSS fallback handles it
      }
    };
    lockOrientation();

    return () => {
      try {
        const orientation = screen.orientation as ScreenOrientation & {
          unlock?: () => void;
        };
        orientation.unlock?.();
      } catch {
        // ignore
      }
    };
  }, []);

  // Portrait detection for rotation overlay
  const [isPortrait, setIsPortrait] = useState(
    () =>
      window.matchMedia("(orientation: portrait)").matches &&
      window.innerWidth <= BREAKPOINTS.TABLET_WIDTH,
  );

  useEffect(() => {
    const mq = window.matchMedia(
      `(orientation: portrait) and (max-width: ${BREAKPOINTS.TABLET_WIDTH}px)`,
    );
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const gameState = initialGameState ?? null;

  return (
    <div style={{ position: "relative", width: "100%", height: "100dvh", overflow: "hidden" }}>
      {isPortrait && (
        <div className="portrait-rotate-overlay">
          <div className="portrait-title">福州麻将</div>
          <div className="portrait-phone-icon phone-rotate-icon">📱</div>
          <div className="portrait-msg">请将手机横屏以获得最佳体验</div>
          <div className="portrait-hint">
            Please rotate your device to landscape mode. The game table requires a wider screen to
            display properly.
          </div>
        </div>
      )}
      <MobileGameTable gameState={gameState} />
      {onLeave && (
        <button
          onClick={onLeave}
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 10,
            padding: "4px 12px",
            fontSize: "0.75rem",
            background: "rgba(0,0,0,0.5)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Leave
        </button>
      )}
    </div>
  );
}
