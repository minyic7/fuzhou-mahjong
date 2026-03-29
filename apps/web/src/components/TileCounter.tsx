import { useState, useMemo } from "react";
import type { ClientGameState, TileInstance, GoldState } from "@fuzhou-mahjong/shared";
import { isSuitedTile } from "@fuzhou-mahjong/shared";

interface TileCounterProps {
  gameState: ClientGameState;
}

const SUITS = ["wan", "bing", "tiao"] as const;
const SUIT_LABELS: Record<string, string> = { wan: "万", bing: "饼", tiao: "条" };
const SUIT_COLORS: Record<string, string> = { wan: "#b71c1c", bing: "#0d47a1", tiao: "#1b5e20" };

/**
 * Count all tiles visible to the current player:
 * - Own hand
 * - Own flowers
 * - Own melds
 * - Own discards
 * - Other players' discards
 * - Other players' melds (face-up)
 * - Other players' flowers
 * - Gold indicator tile
 */
function countVisibleTiles(state: ClientGameState): Map<string, number> {
  const counts = new Map<string, number>();

  const countTile = (t: TileInstance) => {
    if (!isSuitedTile(t.tile)) return;
    const key = `${t.tile.suit}-${t.tile.value}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  // My tiles
  state.myHand.forEach(countTile);
  state.myDiscards.forEach(countTile);
  state.myMelds.forEach(m => m.tiles.forEach(countTile));
  state.myFlowers.forEach(countTile);

  // Other players' visible tiles
  for (const p of state.otherPlayers) {
    p.discards.forEach(countTile);
    p.melds.forEach(m => m.tiles.forEach(countTile));
    p.flowers.forEach(countTile);
  }

  // Gold indicator
  if (state.gold) countTile(state.gold.indicatorTile);

  return counts;
}

export function TileCounter({ gameState }: TileCounterProps) {
  const [expanded, setExpanded] = useState(false);

  const visible = useMemo(() => countVisibleTiles(gameState), [gameState]);

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          padding: "6px 12px",
          fontSize: 12,
          background: "rgba(0,0,0,0.3)",
          border: "1px solid rgba(184,134,11,0.3)",
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
          fontSize: 12,
        }}>
          {SUITS.map(suit => (
            <div key={suit} style={{ marginBottom: 6 }}>
              <div style={{ color: SUIT_COLORS[suit], fontWeight: "bold", marginBottom: 2 }}>
                {SUIT_LABELS[suit]}
              </div>
              <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(value => {
                  const key = `${suit}-${value}`;
                  const seen = visible.get(key) ?? 0;
                  const remaining = 4 - seen;
                  return (
                    <div
                      key={value}
                      style={{
                        width: 28,
                        height: 28,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 3,
                        fontSize: 11,
                        fontWeight: "bold",
                        background: remaining === 0
                          ? "rgba(244,67,54,0.2)"
                          : remaining <= 1
                          ? "rgba(255,167,38,0.15)"
                          : "rgba(255,255,255,0.05)",
                        color: remaining === 0
                          ? "#f44336"
                          : remaining <= 1
                          ? "#ffa726"
                          : "#8fbc8f",
                        border: remaining === 0 ? "1px solid rgba(244,67,54,0.3)" : "1px solid rgba(255,255,255,0.1)",
                      }}
                      title={`${value}${SUIT_LABELS[suit]}: 已见${seen}/4 剩余${remaining}`}
                    >
                      {value}<sub style={{ fontSize: 8 }}>{remaining}</sub>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
