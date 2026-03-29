import { useState, useMemo } from "react";
import type { ClientGameState, TileInstance } from "@fuzhou-mahjong/shared";
import { isSuitedTile } from "@fuzhou-mahjong/shared";

interface TileCounterProps {
  gameState: ClientGameState;
}

const SUITS = ["wan", "bing", "tiao"] as const;
const SUIT_LABELS: Record<string, string> = { wan: "万", bing: "饼", tiao: "条" };
const SUIT_COLORS: Record<string, string> = { wan: "#e57373", bing: "#64b5f6", tiao: "#81c784" };
const CN_NUMS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

function countVisibleTiles(state: ClientGameState): Map<string, number> {
  const counts = new Map<string, number>();
  const count = (t: TileInstance) => {
    if (!isSuitedTile(t.tile)) return;
    const key = `${t.tile.suit}-${t.tile.value}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  state.myHand.forEach(count);
  state.myDiscards.forEach(count);
  state.myMelds.forEach(m => m.tiles.forEach(count));
  state.myFlowers.forEach(count);
  for (const p of state.otherPlayers) {
    p.discards.forEach(count);
    p.melds.forEach(m => m.tiles.forEach(count));
    p.flowers.forEach(count);
  }
  if (state.gold) count(state.gold.indicatorTile);
  return counts;
}

/** Render 4 dots: ● for remaining, ○ for seen */
function Dots({ total, remaining }: { total: number; remaining: number }) {
  return (
    <div style={{ display: "flex", gap: 1, justifyContent: "center", marginTop: 2 }}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} style={{
          fontSize: 6,
          color: i < remaining ? "#4caf50" : "rgba(255,255,255,0.2)",
        }}>
          ●
        </span>
      ))}
    </div>
  );
}

function TileCell({ label, remaining, total, color }: {
  label: string; remaining: number; total: number; color: string;
}) {
  const allGone = remaining === 0;
  return (
    <div style={{
      width: 32,
      height: 40,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 4,
      background: allGone ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.1)",
      opacity: allGone ? 0.35 : 1,
      textDecoration: allGone ? "line-through" : "none",
    }}>
      <span style={{
        fontSize: 14,
        fontWeight: "bold",
        color: allGone ? "#666" : color,
        lineHeight: 1,
      }}>
        {label}
      </span>
      <Dots total={total} remaining={remaining} />
    </div>
  );
}

export function TileCounter({ gameState }: TileCounterProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = useMemo(() => countVisibleTiles(gameState), [gameState]);

  return (
    <div style={{ marginTop: 4, flexShrink: 0 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          padding: "4px 12px",
          fontSize: 12,
          background: expanded ? "rgba(255,215,0,0.1)" : "rgba(0,0,0,0.3)",
          border: `1px solid ${expanded ? "rgba(255,215,0,0.4)" : "rgba(184,134,11,0.3)"}`,
          color: "#e8d5a3",
          borderRadius: 4,
          minHeight: "auto",
          cursor: "pointer",
        }}
      >
        {expanded ? "▼ 记牌器" : "▶ 记牌器"}
      </button>

      {expanded && (
        <div style={{
          marginTop: 4,
          padding: 8,
          background: "rgba(0,0,0,0.4)",
          borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          {SUITS.map(suit => (
            <div key={suit} style={{ marginBottom: 6 }}>
              <div style={{ color: SUIT_COLORS[suit], fontWeight: "bold", fontSize: 10, marginBottom: 2 }}>
                {SUIT_LABELS[suit]}
              </div>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(value => {
                  const key = `${suit}-${value}`;
                  const seen = visible.get(key) ?? 0;
                  return (
                    <TileCell
                      key={value}
                      label={CN_NUMS[value]}
                      remaining={4 - seen}
                      total={4}
                      color={SUIT_COLORS[suit]}
                    />
                  );
                })}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 4, textAlign: "center" }}>
            ● 剩余 &nbsp; ○ 已见
          </div>
        </div>
      )}
    </div>
  );
}
