import type { TileInstance, GoldState, SuitedTile, Tile } from "@fuzhou-mahjong/shared";
import { isGoldTile, isSuitedTile } from "@fuzhou-mahjong/shared";

interface TileProps {
  tile: TileInstance;
  faceUp?: boolean;
  selected?: boolean;
  claimable?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  gold?: GoldState | null;
  small?: boolean;
  className?: string;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchEnd?: () => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}

const SUIT_CHARS: Record<string, string> = { wan: "万", bing: "饼", tiao: "条" };
const SUIT_COLORS: Record<string, string> = { wan: "#b71c1c", bing: "#0d47a1", tiao: "#1b5e20" };

const FLOWER_CHARS: Record<string, Record<string, string>> = {
  wind: { east: "東", south: "南", west: "西", north: "北" },
  dragon: { red: "中", green: "發", white: "白" },
  season: { spring: "春", summer: "夏", autumn: "秋", winter: "冬" },
  plant: { plum: "梅", orchid: "蘭", bamboo: "竹", chrysanthemum: "菊" },
};

function getTileDisplay(tile: Tile): { value: string; suit: string; color: string } {
  if (isSuitedTile(tile)) {
    const cn = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
    return { value: cn[tile.value], suit: SUIT_CHARS[tile.suit], color: SUIT_COLORS[tile.suit] };
  }
  switch (tile.kind) {
    case "wind": return { value: FLOWER_CHARS.wind[tile.windType], suit: "", color: "#1a237e" };
    case "dragon": {
      const colors: Record<string, string> = { red: "#b71c1c", green: "#1b5e20", white: "#37474f" };
      return { value: FLOWER_CHARS.dragon[tile.dragonType], suit: "", color: colors[tile.dragonType] };
    }
    case "season": return { value: FLOWER_CHARS.season[tile.seasonType], suit: "", color: "#e65100" };
    case "plant": return { value: FLOWER_CHARS.plant[tile.plantType], suit: "", color: "#4a148c" };
  }
}

export function TileView({ tile, faceUp = true, selected, claimable, onClick, onDoubleClick, gold, small, className, onTouchStart, onTouchEnd, onMouseEnter, onMouseLeave }: TileProps) {
  const w = small ? 30 : 44;
  const h = small ? 40 : 60;
  const fontSize = small ? 13 : 18;
  const suitSize = small ? 9 : 11;
  const isGold = gold && isSuitedTile(tile.tile) && isGoldTile(tile, gold);

  if (!faceUp) {
    return (
      <div style={{
        width: w, height: h,
        background: "linear-gradient(135deg, #2e7d32 0%, #1b5e20 50%, #2e7d32 100%)",
        border: "1px solid #1a3c2a",
        borderRadius: 4,
        display: "inline-block",
        margin: 1,
        boxShadow: "inset 0 0 8px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.4)",
        position: "relative",
      }}>
        {/* Decorative pattern on tile back */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: w * 0.5, height: h * 0.5,
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 2,
        }} />
      </div>
    );
  }

  const { value, suit, color } = getTileDisplay(tile.tile);

  return (
    <div
      className={className || (claimable ? "tile-claimable" : undefined)}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        width: w, height: h,
        background: selected
          ? "linear-gradient(180deg, #fff8e1 0%, #ffe082 100%)"
          : claimable
          ? "linear-gradient(180deg, #e8f5e9 0%, #c8e6c9 100%)"
          : "linear-gradient(180deg, #fafaf0 0%, #e8e4d4 100%)",
        border: selected
          ? "2px solid #ff8f00"
          : isGold
          ? "2px solid #ffd700"
          : claimable
          ? "2px solid #00e676"
          : "1px solid #bbb",
        borderRadius: 5,
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: onClick ? "pointer" : "default",
        margin: 1,
        boxShadow: selected
          ? "0 6px 16px rgba(255,143,0,0.4), 0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.8)"
          : isGold
          ? "0 0 8px rgba(255,215,0,0.6), 0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.8)"
          : "0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.8)",
        transform: selected ? "translateY(-10px) scale(1.12)" : "none",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative",
      }}
    >
      {/* Main character */}
      <span style={{
        fontSize,
        fontWeight: 900,
        color,
        lineHeight: 1,
        textShadow: "0 1px 0 rgba(255,255,255,0.5)",
      }}>
        {value}
      </span>
      {/* Suit label */}
      {suit && (
        <span style={{
          fontSize: suitSize,
          color,
          opacity: 0.7,
          lineHeight: 1,
          marginTop: 1,
        }}>
          {suit}
        </span>
      )}
      {/* Gold shimmer overlay */}
      {isGold && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          borderRadius: 4,
          background: "linear-gradient(135deg, transparent 30%, rgba(255,215,0,0.15) 50%, transparent 70%)",
          pointerEvents: "none",
        }} />
      )}
    </div>
  );
}
