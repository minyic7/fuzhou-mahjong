import { useState, useEffect, useRef } from "react";
import type { GoldState, TileInstance } from "@fuzhou-mahjong/shared";
import { TileView } from "./Tile";
import { isMuted, setMuted } from "../sounds";

interface GameInfoProps {
  gold: GoldState | null;
  wallRemaining?: number;
  dealerIndex: number;
  lianZhuangCount: number;
  myIndex: number;
  lastDiscard: { tile: TileInstance; playerIndex: number } | null;
  playerNames: string[];
  compact?: boolean;
}

export function GameInfo({ gold, wallRemaining, dealerIndex, lianZhuangCount, myIndex, lastDiscard, playerNames, compact }: GameInfoProps) {
  const [goldFlip, setGoldFlip] = useState(false);
  const prevGoldRef = useRef<number | null>(null);

  useEffect(() => {
    if (gold) {
      const key = gold.indicatorTile.id;
      if (prevGoldRef.current !== key) {
        prevGoldRef.current = key;
        setGoldFlip(true);
      }
    } else {
      prevGoldRef.current = null;
      setGoldFlip(false);
    }
  }, [gold]);

  const posLabel = (idx: number) => {
    const rel = (idx - myIndex + 4) % 4;
    return rel === 0 ? "我" : (playerNames[rel] || ["我", "右", "上", "左"][rel]);
  };

  if (compact) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 8, padding: "2px 8px", fontSize: 11,
        color: "var(--color-text-secondary)",
        background: "rgba(0,0,0,0.2)", borderRadius: 4,
        maxHeight: 28,
      }}>
        {gold && <TileView tile={gold.indicatorTile} faceUp gold={null} small />}
        <span>余{wallRemaining}</span>
        <span>庄:{posLabel(dealerIndex)}</span>
        {lianZhuangCount > 0 && <span>连{lianZhuangCount}</span>}
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      padding: 12,
      background: "rgba(0,0,0,0.3)",
      borderRadius: 8,
    }}>
      <div style={{ marginBottom: 8 }}>
        <span style={{ color: "var(--color-text-secondary)", fontSize: 12 }}>金牌: </span>
        {gold && <TileView tile={gold.indicatorTile} faceUp gold={null} small className={`gold-indicator-glow${goldFlip ? " gold-flip-reveal" : ""}`} />}
      </div>

      {lastDiscard && (
        <div style={{
          marginBottom: 8,
          padding: 8,
          background: "rgba(255,165,0,0.15)",
          borderRadius: 6,
          border: "1px solid rgba(255,165,0,0.4)",
        }}>
          <div style={{ fontSize: 11, color: "var(--color-accent-orange)", marginBottom: 4 }}>
            {posLabel(lastDiscard.playerIndex)} 打出:
          </div>
          <TileView tile={lastDiscard.tile} faceUp gold={gold} />
        </div>
      )}

      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
        庄:{posLabel(dealerIndex)} | 连庄:{lianZhuangCount}
      </div>
      {wallRemaining !== undefined && (
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
          余{wallRemaining}
        </div>
      )}
      {wallRemaining !== undefined && wallRemaining <= 10 && (
        <div
          className="wall-low-pulse"
          style={{
            fontSize: 11,
            color: "var(--color-error)",
            padding: "2px 6px",
            borderRadius: 4,
            background: "rgba(244,67,54,0.15)",
          }}
        >
          牌墙将尽
        </div>
      )}
    </div>
  );
}

function MuteButton() {
  const [muted, setMutedState] = useState(isMuted());
  return (
    <button
      onClick={() => { setMuted(!muted); setMutedState(!muted); }}
      style={{
        marginTop: 6, padding: "2px 8px", fontSize: 12,
        background: "transparent", border: "1px solid var(--color-text-secondary)",
        color: "var(--color-text-secondary)", borderRadius: 4, minHeight: 44,
        cursor: "pointer",
      }}
    >
      {muted ? "🔇 静音" : "🔊 音效"}
    </button>
  );
}
