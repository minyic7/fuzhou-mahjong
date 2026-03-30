import { useState, useMemo } from "react";
import type { ClientGameState, TileInstance } from "@fuzhou-mahjong/shared";
import { isSuitedTile } from "@fuzhou-mahjong/shared";

interface TileCounterProps {
  gameState: ClientGameState;
}

const SUITS = ["wan", "bing", "tiao"] as const;
const SUIT_LABELS: Record<string, string> = { wan: "万", bing: "饼", tiao: "条" };
const SUIT_COLORS: Record<string, string> = { wan: "var(--suit-color-wan)", bing: "var(--suit-color-tong)", tiao: "var(--suit-color-tiao)" };
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
          fontSize: "var(--font-dot)",
          color: i < remaining ? "var(--color-success)" : "var(--color-text-muted)",
          opacity: i < remaining ? 1 : 0.2,
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
      width: "var(--counter-tile-w)",
      height: "var(--counter-tile-h)",
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
        fontSize: "var(--font-md)",
        fontWeight: "bold",
        color: allGone ? "var(--color-text-secondary)" : color,
        opacity: allGone ? 0.5 : 1,
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

  const totalSeen = useMemo(() => {
    let sum = 0;
    for (const v of visible.values()) sum += v;
    return sum;
  }, [visible]);
  const totalRemaining = 27 * 4 - totalSeen; // 108 suited tiles total

  return (
    <div>
      {expanded && (
        <div style={{
          marginBottom: 4,
          padding: 8,
          maxWidth: 200,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderRadius: 8,
          border: "1px solid rgba(255,215,0,0.25)",
        }}>
          {SUITS.map(suit => (
            <div key={suit} style={{ marginBottom: 6 }}>
              <div style={{ color: SUIT_COLORS[suit], fontWeight: "bold", fontSize: "var(--font-xs)", marginBottom: 2 }}>
                {SUIT_LABELS[suit]}
              </div>
              <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
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
          <div style={{ fontSize: "var(--font-xs)", color: "var(--color-text-muted)", opacity: 0.3, marginTop: 4, textAlign: "center" }}>
            ● 剩余 &nbsp; ○ 已见
          </div>
        </div>
      )}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          fontSize: "var(--font-md)",
          background: expanded ? "rgba(255,215,0,0.15)" : "rgba(0,0,0,0.7)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: `1px solid ${expanded ? "rgba(255,215,0,0.4)" : "rgba(184,134,11,0.3)"}`,
          color: "var(--color-text-warm)",
          borderRadius: 20,
          minHeight: 44,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: "var(--font-sm)" }}>{expanded ? "▼" : "▶"}</span>
        <span>牌 {totalRemaining}</span>
      </button>
    </div>
  );
}
