import { useEffect, useState } from "react";
import type { TileInstance, GoldState } from "@fuzhou-mahjong/shared";
import { TileView } from "./Tile";
import { BREAKPOINTS } from "../hooks/useIsMobile";
import { useWindowSize } from "../hooks/useWindowSize";

interface CenterActionProps {
  gold: GoldState | null;
}

export interface ActionDisplay {
  tiles: TileInstance[];
  label: string;
  color: string;
  id: number;
}

let actionId = 0;

export function useCenterAction() {
  const [display, setDisplay] = useState<ActionDisplay | null>(null);

  const showDiscard = (tile: TileInstance, playerName: string) => {
    setDisplay({ tiles: [tile], label: `${playerName} 打`, color: "var(--color-text-warm)", id: ++actionId });
  };

  const showClaim = (tiles: TileInstance[], type: string, playerName: string) => {
    const labels: Record<string, string> = { chi: "吃!", peng: "碰!", mingGang: "杠!", anGang: "暗杠!", buGang: "补杠!", hu: "胡!" };
    const colors: Record<string, string> = { chi: "var(--color-action-chi)", peng: "var(--color-action-peng)", mingGang: "var(--color-action-gang)", anGang: "var(--color-action-gang)", buGang: "var(--color-action-gang)", hu: "var(--color-action-hu)" };
    setDisplay({
      tiles,
      label: `${playerName} ${labels[type] || type}`,
      color: colors[type] || "#fff",
      id: ++actionId,
    });
  };

  // Auto-dismiss after animation
  useEffect(() => {
    if (!display) return;
    const timer = setTimeout(() => setDisplay(null), 1200);
    return () => clearTimeout(timer);
  }, [display?.id]);

  return { display, showDiscard, showClaim };
}

export function CenterAction({ display, gold }: { display: ActionDisplay | null; gold: GoldState | null }) {
  const { width, height } = useWindowSize();
  if (!display) return null;

  const isCompact = height <= BREAKPOINTS.COMPACT_HEIGHT;
  const tileCount = display.tiles.length;
  // Base tile width mirrors CSS --tile-w breakpoints
  const baseTileW = width <= 360 ? 30 : width <= 480 ? 34 : 44;
  const gap = 4;
  const maxMeldWidth = width * 0.9;
  // scale applies per-tile via transform (doesn't affect layout), so visual width =
  // tileCount * baseTileW * scale + (tileCount - 1) * gap
  // Solve for max scale: scale <= (maxMeldWidth - (tileCount - 1) * gap) / (tileCount * baseTileW)
  const maxScale = (maxMeldWidth - (tileCount - 1) * gap) / (tileCount * baseTileW);
  const scale = isCompact ? 1.2 : Math.min(1.8, maxScale);

  return (
    <div
      key={display.id}
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: "var(--z-center-action)" as any,
        textAlign: "center",
        animation: "centerActionIn 0.3s ease-out, centerActionOut 0.4s ease-in 0.8s forwards",
        pointerEvents: "none",
      }}
    >
      <div style={{
        display: "flex",
        gap: 4,
        justifyContent: "center",
        marginBottom: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
      }}>
        {display.tiles.map((t) => (
          <div key={t.id} style={{ transform: `scale(${scale})` }}>
            <TileView tile={t} faceUp gold={gold} />
          </div>
        ))}
      </div>
      <div style={{
        fontSize: "var(--font-xl)",
        fontWeight: "bold",
        color: display.color,
        textShadow: `0 0 20px ${display.color}, 0 2px 4px rgba(0,0,0,0.5)`,
      }}>
        {display.label}
      </div>
    </div>
  );
}
