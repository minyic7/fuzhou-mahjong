import type { TileInstance, Meld, GoldState } from "@fuzhou-mahjong/shared";
import { MeldType } from "@fuzhou-mahjong/shared";
import { TileView } from "./Tile";

interface MobileOpponentAreaProps {
  position: "left" | "right" | "top";
  name: string;
  handCount: number;
  melds: Meld[];
  flowers: TileInstance[];
  discards: TileInstance[];
  isCurrentTurn: boolean;
  isDealer: boolean;
  gold: GoldState | null;
  isDisconnected?: boolean;
  cumulativeScore?: number;
  lastDiscardedTileId?: number | null;
}

const FLOWER_CHARS: Record<string, Record<string, string>> = {
  wind: { east: "東", south: "南", west: "西", north: "北" },
  dragon: { red: "中", green: "發", white: "白" },
  season: { spring: "春", summer: "夏", autumn: "秋", winter: "冬" },
  plant: { plum: "梅", orchid: "蘭", bamboo: "竹", chrysanthemum: "菊" },
};

function getFlowerChar(tile: TileInstance): string {
  const t = tile.tile;
  if (t.kind === "wind") return FLOWER_CHARS.wind[t.windType] ?? "";
  if (t.kind === "dragon") return FLOWER_CHARS.dragon[t.dragonType] ?? "";
  if (t.kind === "season") return FLOWER_CHARS.season[t.seasonType] ?? "";
  if (t.kind === "plant") return FLOWER_CHARS.plant[t.plantType] ?? "";
  return "";
}

/** Count melds by type for compact display */
function meldSummary(melds: Meld[]): string {
  const counts: Record<string, number> = {};
  for (const m of melds) {
    if (m.type === MeldType.Chi) counts["吃"] = (counts["吃"] ?? 0) + 1;
    else if (m.type === MeldType.Peng) counts["碰"] = (counts["碰"] ?? 0) + 1;
    else counts["杠"] = (counts["杠"] ?? 0) + 1; // mingGang, anGang, buGang
  }
  return Object.entries(counts)
    .map(([k, v]) => `${k}x${v}`)
    .join(" ");
}

/* ─── Side opponent (left / right) ─── */

function SideOpponent({
  name, handCount, melds, flowers, isCurrentTurn, isDealer, isDisconnected,
}: MobileOpponentAreaProps) {
  return (
    <div
      style={{
        writingMode: "vertical-rl",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "6px 2px",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        fontSize: 11,
        overflow: "hidden",
        background: isCurrentTurn ? "rgba(255,255,100,0.1)" : "transparent",
      }}
    >
      {/* Player name */}
      <span
        style={{
          fontWeight: isCurrentTurn ? 700 : 400,
          maxHeight: "4em",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontSize: 11,
        }}
      >
        {name}
      </span>

      {/* Tile count */}
      <span
        style={{
          background: "rgba(255,255,255,0.15)",
          borderRadius: 4,
          padding: "1px 3px",
          fontSize: 10,
        }}
      >
        🀫{handCount}
      </span>

      {/* Meld summary */}
      {melds.length > 0 && (
        <span style={{ fontSize: 10, opacity: 0.85 }}>
          {meldSummary(melds)}
        </span>
      )}

      {/* Flower count */}
      {flowers.length > 0 && (
        <span
          style={{
            background: "rgba(129,199,132,0.3)",
            borderRadius: 4,
            padding: "1px 3px",
            fontSize: 10,
            color: "#a5d6a7",
          }}
        >
          花{flowers.length}
        </span>
      )}

      {/* Dealer badge */}
      {isDealer && (
        <span
          style={{
            background: "rgba(232,212,77,0.3)",
            borderRadius: 4,
            padding: "1px 3px",
            fontSize: 10,
            color: "#e8d44d",
          }}
        >
          庄
        </span>
      )}

      {/* Disconnect indicator */}
      {isDisconnected && (
        <span style={{ color: "#ef5350", fontSize: 10 }}>断线</span>
      )}
    </div>
  );
}

/* ─── Top opponent ─── */

function TopOpponent({
  name, handCount, melds, flowers, discards, isCurrentTurn, isDealer,
  gold, isDisconnected, cumulativeScore, lastDiscardedTileId,
}: MobileOpponentAreaProps) {
  const lastDiscards = discards.slice(-4);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        padding: "4px 8px",
        gap: 6,
        overflow: "hidden",
        background: isCurrentTurn ? "rgba(255,255,100,0.08)" : "transparent",
        borderBottom: isCurrentTurn
          ? "2px solid rgba(255,255,100,0.4)"
          : "1px solid rgba(255,255,255,0.15)",
      }}
    >
      {/* Left: name + badges */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 2,
          minWidth: 0,
          flexShrink: 1,
        }}
      >
        <span
          style={{
            fontWeight: isCurrentTurn ? 700 : 400,
            fontSize: 12,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "100%",
          }}
        >
          {name}
          {isDealer && (
            <span
              style={{
                marginLeft: 4,
                background: "rgba(232,212,77,0.3)",
                borderRadius: 3,
                padding: "0 3px",
                fontSize: 10,
                color: "#e8d44d",
              }}
            >
              庄
            </span>
          )}
          {isDisconnected && (
            <span style={{ marginLeft: 4, color: "#ef5350", fontSize: 10 }}>
              断线
            </span>
          )}
        </span>
      </div>

      {/* Center: tile count + melds + flowers + discards */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          flex: 1,
          justifyContent: "center",
          overflow: "hidden",
          flexWrap: "wrap",
        }}
      >
        {/* Face-down tile count */}
        <span
          style={{
            background: "rgba(255,255,255,0.15)",
            borderRadius: 4,
            padding: "1px 4px",
            fontSize: 10,
          }}
        >
          🀫{handCount}
        </span>

        {/* Melds: render small tiles */}
        {melds.map((meld, mi) => (
          <span
            key={mi}
            style={{ display: "inline-flex", gap: 0, marginLeft: 2 }}
          >
            {meld.tiles.map((tile) => (
              <TileView
                key={tile.id}
                tile={tile}
                faceUp={meld.type !== MeldType.AnGang}
                small
                gold={gold}
                style={{ width: 20, height: 28, fontSize: 9 }}
              />
            ))}
          </span>
        ))}

        {/* Flower badges */}
        {flowers.map((f) => (
          <span
            key={f.id}
            style={{
              background: "rgba(129,199,132,0.3)",
              borderRadius: 3,
              padding: "0 3px",
              fontSize: 10,
              color: "#a5d6a7",
            }}
          >
            {getFlowerChar(f)}
          </span>
        ))}

        {/* Last discards */}
        {lastDiscards.length > 0 && (
          <span
            style={{
              display: "inline-flex",
              gap: 1,
              marginLeft: 4,
              opacity: 0.8,
            }}
          >
            {lastDiscards.map((tile) => (
              <TileView
                key={tile.id}
                tile={tile}
                faceUp
                small
                gold={gold}
                style={{ width: 16, height: 22, fontSize: 8 }}
                className={
                  tile.id === lastDiscardedTileId ? "last-discard" : undefined
                }
              />
            ))}
          </span>
        )}
      </div>

      {/* Right: score */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          whiteSpace: "nowrap",
          opacity: 0.9,
          flexShrink: 0,
        }}
      >
        {cumulativeScore != null ? `${cumulativeScore >= 0 ? "+" : ""}${cumulativeScore}` : ""}
      </div>
    </div>
  );
}

/* ─── Main export ─── */

export function MobileOpponentArea(props: MobileOpponentAreaProps) {
  if (props.position === "top") return <TopOpponent {...props} />;
  return <SideOpponent {...props} />;
}
