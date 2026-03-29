import type { TileInstance, GoldState, SuitedTile, Tile } from "@fuzhou-mahjong/shared";
import { isGoldTile, isSuitedTile } from "@fuzhou-mahjong/shared";

interface TileProps {
  tile: TileInstance;
  faceUp?: boolean;
  selected?: boolean;
  onClick?: () => void;
  gold?: GoldState | null;
  small?: boolean;
}

const SUIT_CHARS: Record<string, string> = { wan: "万", bing: "饼", tiao: "条" };
const SUIT_COLORS: Record<string, string> = { wan: "#c41e3a", bing: "#1e6ec4", tiao: "#2e8b57" };

const FLOWER_CHARS: Record<string, Record<string, string>> = {
  wind: { east: "东", south: "南", west: "西", north: "北" },
  dragon: { red: "中", green: "发", white: "白" },
  season: { spring: "春", summer: "夏", autumn: "秋", winter: "冬" },
  plant: { plum: "梅", orchid: "兰", bamboo: "竹", chrysanthemum: "菊" },
};

function getTileText(tile: Tile): { text: string; color: string } {
  if (isSuitedTile(tile)) {
    const st = tile as SuitedTile;
    return { text: `${st.value}${SUIT_CHARS[st.suit]}`, color: SUIT_COLORS[st.suit] };
  }
  switch (tile.kind) {
    case "wind": return { text: FLOWER_CHARS.wind[tile.windType], color: "#333" };
    case "dragon": {
      const colors: Record<string, string> = { red: "#c41e3a", green: "#2e8b57", white: "#666" };
      return { text: FLOWER_CHARS.dragon[tile.dragonType], color: colors[tile.dragonType] };
    }
    case "season": return { text: FLOWER_CHARS.season[tile.seasonType], color: "#b8860b" };
    case "plant": return { text: FLOWER_CHARS.plant[tile.plantType], color: "#8b4513" };
  }
}

export function TileView({ tile, faceUp = true, selected, onClick, gold, small }: TileProps) {
  const size = small ? { width: 28, height: 38, fontSize: 11 } : { width: 40, height: 56, fontSize: 15 };
  const isGold = gold && isSuitedTile(tile.tile) && isGoldTile(tile, gold);

  if (!faceUp) {
    return (
      <div style={{
        ...size,
        background: "#2a5c3a",
        border: "1px solid #1a3c2a",
        borderRadius: 3,
        display: "inline-block",
        margin: 1,
      }} />
    );
  }

  const { text, color } = getTileText(tile.tile);

  return (
    <div
      onClick={onClick}
      style={{
        ...size,
        background: selected ? "#ffe4b5" : "#f5f0e0",
        border: isGold ? "2px solid #ffd700" : "1px solid #999",
        borderRadius: 3,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: onClick ? "pointer" : "default",
        color,
        fontWeight: "bold",
        margin: 1,
        boxShadow: isGold ? "0 0 4px #ffd700" : "0 1px 2px rgba(0,0,0,0.3)",
        transform: selected ? "translateY(-8px) scale(1.1)" : "none",
        transition: "all 0.15s ease",
      }}
    >
      {text}
    </div>
  );
}
