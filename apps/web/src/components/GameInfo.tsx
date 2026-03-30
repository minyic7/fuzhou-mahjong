import { useState } from "react";
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
}

export function GameInfo({ gold, dealerIndex, lianZhuangCount, myIndex, lastDiscard, playerNames }: GameInfoProps) {
  const posLabel = (idx: number) => {
    const rel = (idx - myIndex + 4) % 4;
    return rel === 0 ? "我" : (playerNames[rel] || ["我", "右", "上", "左"][rel]);
  };

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
        <span style={{ color: "#aaa", fontSize: 12 }}>金牌: </span>
        {gold && <TileView tile={gold.indicatorTile} faceUp gold={null} small />}
      </div>

      {lastDiscard && (
        <div style={{
          marginBottom: 8,
          padding: 8,
          background: "rgba(255,165,0,0.15)",
          borderRadius: 6,
          border: "1px solid rgba(255,165,0,0.4)",
        }}>
          <div style={{ fontSize: 11, color: "#ffa500", marginBottom: 4 }}>
            {posLabel(lastDiscard.playerIndex)} 打出:
          </div>
          <TileView tile={lastDiscard.tile} faceUp gold={gold} />
        </div>
      )}

      <div style={{ fontSize: 12, color: "#8fbc8f" }}>
        庄:{posLabel(dealerIndex)} | 连庄:{lianZhuangCount}
      </div>
      <MuteButton />
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
        background: "transparent", border: "1px solid #555",
        color: "#8fbc8f", borderRadius: 4, minHeight: "auto",
        cursor: "pointer",
      }}
    >
      {muted ? "🔇 静音" : "🔊 音效"}
    </button>
  );
}
