import { useState } from "react";
import type { TileInstance, GoldState, SuitedTile, Tile } from "@fuzhou-mahjong/shared";
import { isGoldTile, isSuitedTile } from "@fuzhou-mahjong/shared";
import { getTileSvgUrl, TILE_BACK_URL } from "../tileSvg";
import { getTileName } from "./TileTooltip";

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
  style?: React.CSSProperties;
}

const SUIT_CHARS: Record<string, string> = { wan: "万", bing: "饼", tiao: "条" };
const SUIT_COLORS: Record<string, string> = { wan: "var(--suit-color-wan)", bing: "var(--suit-color-tong)", tiao: "var(--suit-color-tiao)" };

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
      const colors: Record<string, string> = { red: "var(--suit-color-wan)", green: "#1b5e20", white: "#37474f" };
      return { value: FLOWER_CHARS.dragon[tile.dragonType], suit: "", color: colors[tile.dragonType] };
    }
    case "season": return { value: FLOWER_CHARS.season[tile.seasonType], suit: "", color: "#e65100" };
    case "plant": return { value: FLOWER_CHARS.plant[tile.plantType], suit: "", color: "#4a148c" };
  }
}

export function TileView({ tile, faceUp = true, selected, claimable, onClick, onDoubleClick, gold, small, className, onTouchStart, onTouchEnd, onMouseEnter, onMouseLeave, style: styleProp }: TileProps) {
  const w = styleProp?.width as string ?? (small ? "var(--tile-w-sm)" : "var(--tile-w)");
  const h = styleProp?.height as string ?? (small ? "var(--tile-h-sm)" : "var(--tile-h)");
  const fontSize = styleProp?.fontSize as string ?? (small ? "var(--tile-font-sm)" : "var(--tile-font)");
  const suitSize = small ? "var(--tile-suit-font-sm)" : "var(--tile-suit-font)";
  const isGold = gold && isSuitedTile(tile.tile) && isGoldTile(tile, gold);

  if (!faceUp) {
    return (
      <div style={{
        flex: `0 1 ${w}`, height: h, minWidth: 0,
        borderRadius: "var(--radius-sm)",
        borderBottom: "3px solid var(--color-tile-back-border)",
        borderRight: "2px solid var(--color-tile-back-border-right)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "var(--tile-margin, 1px)",
        boxShadow: "0 3px 6px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.2)",
        overflow: "hidden",
      }}>
        <img
          src={TILE_BACK_URL}
          alt="tile back"
          style={{ width: "100%", height: "100%", display: "block" }}
          loading="lazy"
        />
      </div>
    );
  }

  const { value, suit, color } = getTileDisplay(tile.tile);

  return (
    <div
      className={className || (claimable ? "tile-claimable" : undefined)}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={getTileName(tile.tile) + (isGold ? " (金牌)" : "") + (selected ? " (已选)" : "")}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        flex: `0 1 ${w}`, height: h, minWidth: 0,
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
        borderRadius: "var(--radius-sm)",
        borderBottom: selected ? "2px solid #ff8f00" : "3px solid #a09880",
        borderRight: selected ? "2px solid #ff8f00" : "2px solid #b0a890",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: onClick ? "pointer" : "default",
        margin: "var(--tile-margin, 1px)",
        boxShadow: selected
          ? "0 8px 20px rgba(255,143,0,0.4), 0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.8)"
          : isGold
          ? "0 0 8px rgba(255,215,0,0.6), 0 3px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.8)"
          : "0 3px 6px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.8)",
        transform: selected
          ? "translateY(-10px) translateZ(20px) scale(1.12)"
          : "translateZ(0)",
        transformStyle: "preserve-3d" as any,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative",
      }}
    >
      <TileFace tile={tile.tile} w={w} h={h} value={value} suit={suit} color={color} fontSize={fontSize} suitSize={suitSize} />
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

function TileFace({ tile, w, h, value, suit, color, fontSize, suitSize }: {
  tile: Tile; w: string; h: string; value: string; suit: string; color: string; fontSize: string; suitSize: string;
}) {
  const [svgFailed, setSvgFailed] = useState(false);
  const svgUrl = getTileSvgUrl(tile);

  if (svgUrl && !svgFailed) {
    return (
      <img
        src={svgUrl}
        alt={`${value}${suit}`}
        onError={() => setSvgFailed(true)}
        style={{
          width: `calc(${w} - 6px)`,
          height: `calc(${h} - 6px)`,
          objectFit: "contain",
          pointerEvents: "none",
        }}
        loading="lazy"
        draggable={false}
      />
    );
  }

  // Text fallback — wrapped to match SVG sizing
  return (
    <div style={{
      width: `calc(${w} - 6px)`,
      height: `calc(${h} - 6px)`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <span style={{ fontSize, fontWeight: 900, color, lineHeight: 1, textShadow: "0 1px 0 rgba(255,255,255,0.5)" }}>
        {value}
      </span>
      {suit && (
        <span style={{ fontSize: suitSize, color, opacity: 0.7, lineHeight: 1, marginTop: 1 }}>
          {suit}
        </span>
      )}
    </div>
  );
}
