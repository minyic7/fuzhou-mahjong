import { useCallback, useRef, useState } from "react";
import type { TileInstance, GoldState, Tile } from "@fuzhou-mahjong/shared";
import { isSuitedTile, isGoldTile } from "@fuzhou-mahjong/shared";

const SUIT_NAMES: Record<string, string> = { wan: "万", bing: "饼", tiao: "条" };
const VALUE_NAMES = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const WIND_NAMES: Record<string, string> = { east: "东风", south: "南风", west: "西风", north: "北风" };
const DRAGON_NAMES: Record<string, string> = { red: "红中", green: "发财", white: "白板" };
const SEASON_NAMES: Record<string, string> = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
const PLANT_NAMES: Record<string, string> = { plum: "梅", orchid: "兰", bamboo: "竹", chrysanthemum: "菊" };

export function getTileName(tile: Tile): string {
  if (isSuitedTile(tile)) {
    return `${VALUE_NAMES[tile.value]}${SUIT_NAMES[tile.suit]}`;
  }
  switch (tile.kind) {
    case "wind": return WIND_NAMES[tile.windType] ?? "";
    case "dragon": return DRAGON_NAMES[tile.dragonType] ?? "";
    case "season": return SEASON_NAMES[tile.seasonType] ?? "";
    case "plant": return PLANT_NAMES[tile.plantType] ?? "";
  }
}

interface TooltipState {
  visible: boolean;
  tile: TileInstance | null;
  x: number;
  y: number;
}

export function useLongPress(gold: GoldState | null) {
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, tile: null, x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTouchStart = useCallback((tile: TileInstance, e: React.TouchEvent) => {
    const touch = e.touches[0];
    timerRef.current = setTimeout(() => {
      setTooltip({ visible: true, tile, x: touch.clientX, y: touch.clientY });
    }, 500);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setTooltip((t) => t.visible ? { ...t, visible: false } : t);
  }, []);

  const onMouseEnter = useCallback((tile: TileInstance, e: React.MouseEvent) => {
    // Desktop: show on hover after short delay
    timerRef.current = setTimeout(() => {
      setTooltip({ visible: true, tile, x: e.clientX, y: e.clientY });
    }, 800);
  }, []);

  const onMouseLeave = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setTooltip((t) => t.visible ? { ...t, visible: false } : t);
  }, []);

  const Tooltip = () => {
    if (!tooltip.visible || !tooltip.tile) return null;
    const tile = tooltip.tile;
    const name = getTileName(tile.tile);
    const isGold = gold && isSuitedTile(tile.tile) && isGoldTile(tile, gold);

    return (
      <div style={{
        position: "fixed",
        left: Math.min(tooltip.x - 40, window.innerWidth - 120),
        top: Math.max(tooltip.y - 100, 10),
        background: "var(--color-bg-dark)",
        border: isGold ? "2px solid var(--color-gold-bright)" : "1px solid var(--color-text-secondary)",
        borderRadius: 8,
        padding: 12,
        zIndex: 200,
        textAlign: "center",
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        pointerEvents: "none",
      }}>
        <div style={{ fontSize: 28, marginBottom: 4 }}>{name}</div>
        {isGold && <div style={{ fontSize: 12, color: "var(--color-gold-bright)" }}>金牌 (百搭)</div>}
        {!isSuitedTile(tile.tile) && <div style={{ fontSize: 12, color: "#aab4a0" }}>花牌</div>}
      </div>
    );
  };

  return { onTouchStart, onTouchEnd, onMouseEnter, onMouseLeave, Tooltip };
}
