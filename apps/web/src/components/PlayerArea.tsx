import { useRef } from "react";
import type { TileInstance, Meld, GoldState } from "@fuzhou-mahjong/shared";
import { MeldType } from "@fuzhou-mahjong/shared";
import { TileView } from "./Tile";
import { useLongPress } from "./TileTooltip";
import { useSwipeGesture } from "../hooks/useSwipeGesture";

interface PlayerAreaProps {
  isMe: boolean;
  hand?: TileInstance[];
  handCount?: number;
  melds: Meld[];
  flowers: TileInstance[];
  discards: TileInstance[];
  isCurrentTurn: boolean;
  isDealer: boolean;
  gold: GoldState | null;
  selectedTileId?: number | null;
  onTileClick?: (tile: TileInstance) => void;
  onTileDoubleClick?: (tile: TileInstance) => void;
  label: string;
  claimableTileIds?: Set<number>;
  lastDrawnTileId?: number | null;
  lastDiscardedTileId?: number | null;
  tenpaiTiles?: import("@fuzhou-mahjong/shared").SuitedTile[];
  canDiscard?: boolean;
  onDiscard?: (tileInstanceId: number) => void;
  canHu?: boolean;
  onHu?: () => void;
  kongTileIds?: Set<number>;
  onAnGang?: (tileInstanceId: number) => void;
  onBuGang?: (tileInstanceId: number) => void;
  hasDiscardedGold?: boolean;
  isDisconnected?: boolean;
}

const BUBBLE_BTN = {
  padding: "6px 12px", fontSize: "var(--label-font)", fontWeight: "bold" as const,
  border: "none", borderRadius: 6,
  whiteSpace: "nowrap" as const, minHeight: 44, minWidth: 44,
  cursor: "pointer",
};

export function PlayerArea({
  isMe, hand, handCount, melds, flowers, discards,
  isCurrentTurn, isDealer, gold, selectedTileId, onTileClick, label,
  claimableTileIds, onTileDoubleClick, lastDrawnTileId, lastDiscardedTileId, tenpaiTiles,
  canDiscard, onDiscard, canHu, onHu, kongTileIds, onAnGang, onBuGang, hasDiscardedGold,
  isDisconnected,
}: PlayerAreaProps) {
  const { onTouchStart: lpTouchStart, onTouchEnd: lpTouchEnd, onMouseEnter, onMouseLeave, Tooltip } = useLongPress(gold);

  // Double-tap detection for reliable mobile double-tap
  const lastTapRef = useRef<{ id: number; time: number } | null>(null);
  const handleTap = (t: TileInstance) => {
    const now = Date.now();
    if (lastTapRef.current?.id === t.id && now - lastTapRef.current.time < 300) {
      // Double-tap detected
      lastTapRef.current = null;
      onTileDoubleClick?.(t);
    } else {
      lastTapRef.current = { id: t.id, time: now };
      onTileClick?.(t);
    }
  };

  // Swipe-to-discard gesture
  const swipe = useSwipeGesture({
    onSwipeUp: (tileId: number) => {
      const tile = hand?.find((t) => t.id === tileId);
      if (!tile) return;
      const tileIsGold = !!(gold && tile.tile.kind === "suited" && tile.tile.suit === gold.wildTile.suit && tile.tile.value === gold.wildTile.value);
      if (tileIsGold) {
        // Gold tile safety: select tile to show warning bubble instead of auto-discarding
        onTileClick?.(tile);
      } else {
        onDiscard?.(tileId);
      }
    },
    enabled: !!canDiscard,
    threshold: 40,
  });

  return (
    <>
    <Tooltip />
    <div
      className={isCurrentTurn ? "current-turn" : ""}
      style={{
        padding: 8,
        background: isCurrentTurn ? "rgba(255,255,255,0.08)" : "transparent",
        borderRadius: 8,
        border: isCurrentTurn ? "2px solid #ffd700" : "1px solid transparent",
        overflow: "visible",
        opacity: isDisconnected ? 0.5 : 1,
        transition: "opacity 0.3s ease",
      }}
    >
      {/* Player info panel */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
        padding: "4px 10px",
        background: "rgba(0,0,0,0.3)",
        borderRadius: 4,
        borderLeft: isCurrentTurn ? "3px solid #ffd700" : "3px solid transparent",
      }}>
        <span style={{ fontSize: "var(--label-font)", fontWeight: "bold", color: "#e8d5a3" }}>
          {label}
        </span>
        {isDealer && <span style={{ fontSize: 10, background: "#b71c1c", color: "#ffd700", padding: "1px 5px", borderRadius: 3, fontWeight: "bold" }}>庄</span>}
        {isDisconnected && <span style={{ fontSize: 10, background: "#ff5722", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: "bold", animation: "disconnectPulse 2s ease-in-out infinite" }}>断线</span>}
        {hasDiscardedGold && <span style={{ fontSize: 10, background: "#c41e3a", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: "bold" }}>弃金</span>}
        {isCurrentTurn && <span style={{ fontSize: 10, background: "rgba(255,215,0,0.2)", color: "#ffd700", padding: "1px 5px", borderRadius: 3, border: "1px solid #ffd700" }}>出牌</span>}
        <span style={{ fontSize: 11, color: "#8fbc8f", marginLeft: "auto" }}>
          🌸{flowers.length}
        </span>
      </div>

      {/* Hand */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, marginBottom: 4, alignItems: "flex-end", paddingTop: isMe ? "var(--hand-padding-top)" : 0, overflow: "visible", position: "relative" }}>
        {isMe && hand ? (
          hand.map((t, idx) => {
            const isSelected = selectedTileId === t.id;
            const isKong = kongTileIds?.has(t.id);
            const showBubble = isSelected && (canDiscard || canHu || isKong);
            const isGoldTile = !!(gold && t.tile.kind === "suited" && t.tile.suit === gold.wildTile.suit && t.tile.value === gold.wildTile.value);
            const isAnGang = !!(isKong && onAnGang);
            const isBuGang = !!(isKong && onBuGang);
            const isSwiping = swipe.swipingTileId === t.id;
            const tileSwipeOffset = isSwiping ? swipe.swipeOffset : 0;
            const swipeReady = isSwiping && swipe.swipeOffset < -40;
            return (
            <div
              key={t.id}
              onTouchStart={(e) => swipe.onTouchStart(t.id, e)}
              onTouchMove={swipe.onTouchMove}
              onTouchEnd={(e) => { swipe.onTouchEnd(); }}
              style={{
                display: "inline-flex",
                marginLeft: lastDrawnTileId === t.id ? "var(--hand-new-tile-margin)" : 0,
                position: "relative",
                transform: tileSwipeOffset < 0 ? `translateY(${tileSwipeOffset}px)` : undefined,
                opacity: isSwiping ? 1 - Math.min(0.5, Math.abs(tileSwipeOffset) / 100) : 1,
                transition: isSwiping ? "none" : "transform 0.2s ease, opacity 0.2s ease",
                boxShadow: swipeReady ? "0 0 12px rgba(0,184,148,0.6)" : undefined,
              }}
            >
              {lastDrawnTileId === t.id && (
                <div style={{
                  position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
                  fontSize: 10, color: "#4fc3f7", whiteSpace: "nowrap",
                }}>新牌</div>
              )}
              {/* Discard / Kong bubble */}
              {showBubble && (
                <div className="discard-bubble" style={{
                  position: "absolute",
                  bottom: "100%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  marginBottom: 4,
                  zIndex: 20,
                  animation: "bubbleFadeIn 0.15s ease-out",
                }}>
                  {canHu && (
                    <button
                      style={{ ...BUBBLE_BTN, background: "#c41e3a", color: "#fff", boxShadow: "0 2px 8px rgba(196,30,58,0.5)" }}
                      onClick={(e) => { e.stopPropagation(); onHu?.(); }}
                    >
                      胡!
                    </button>
                  )}
                  {canDiscard && (
                    <button
                      className={isGoldTile ? "gold-warning-pulse" : undefined}
                      style={{
                        ...BUBBLE_BTN,
                        background: isGoldTile ? "#c41e3a" : "#00b894",
                        color: "#fff",
                        boxShadow: isGoldTile ? "0 2px 8px rgba(196,30,58,0.5)" : "0 2px 8px rgba(0,184,148,0.5)",
                      }}
                      onClick={(e) => { e.stopPropagation(); onDiscard?.(t.id); }}
                    >
                      {isGoldTile ? "弃金!" : "出牌"}
                    </button>
                  )}
                  {isAnGang && (
                    <button
                      style={{ ...BUBBLE_BTN, background: "#d4760a", color: "#fff", boxShadow: "0 2px 8px rgba(212,118,10,0.5)" }}
                      onClick={(e) => { e.stopPropagation(); onAnGang?.(t.id); }}
                    >
                      暗杠
                    </button>
                  )}
                  {isBuGang && (
                    <button
                      style={{ ...BUBBLE_BTN, background: "#d4760a", color: "#fff", boxShadow: "0 2px 8px rgba(212,118,10,0.5)" }}
                      onClick={(e) => { e.stopPropagation(); onBuGang?.(t.id); }}
                    >
                      补杠
                    </button>
                  )}
                </div>
              )}
              <TileView
                tile={t}
                faceUp
                gold={gold}
                selected={selectedTileId === t.id}
                claimable={claimableTileIds?.has(t.id) || !!isKong}
                className={lastDrawnTileId === t.id ? "tile-new" : undefined}
                onTouchStart={(e) => lpTouchStart(t, e)}
                onTouchEnd={lpTouchEnd}
                onMouseEnter={(e) => onMouseEnter(t, e)}
                onMouseLeave={onMouseLeave}
                onClick={() => handleTap(t)}
              />
            </div>
            );
          })
        ) : (
          Array.from({ length: handCount ?? 0 }).map((_, i) => (
            <TileView key={i} tile={{ id: -1, tile: { kind: "suited", suit: "wan" as any, value: 1 as any } }} faceUp={false} />
          ))
        )}
      </div>

      {/* Tenpai indicator */}
      {isMe && tenpaiTiles && tenpaiTiles.length > 0 && (
        <div style={{ fontSize: 12, color: "#4caf50", marginBottom: 4 }}>
          🀄 听牌！等: {tenpaiTiles.map(t => `${t.value}${{wan:"万",bing:"饼",tiao:"条"}[t.suit]}`).join(" ")}
        </div>
      )}

      {/* Melds */}
      {melds.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          {melds.map((m, mi) => (
            <div key={mi} style={{ display: "flex", gap: 0 }}>
              {m.tiles.map((t, ti) => (
                <TileView
                  key={ti}
                  tile={t}
                  faceUp={m.type !== MeldType.AnGang}
                  gold={gold}
                  small
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Flowers */}
      {flowers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 0, marginBottom: 4 }}>
          {flowers.map((f) => (
            <TileView key={f.id} tile={f} faceUp gold={gold} small />
          ))}
        </div>
      )}

      {/* Discards - grid layout */}
      {discards.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(var(--discard-cols), auto)`,
          gap: 1,
          padding: "var(--game-padding)",
          background: isMe ? "rgba(0,100,200,0.08)" : "rgba(255,255,255,0.03)",
          borderRadius: 4,
          maxWidth: "min(300px, 90vw)",
        }}>
          {discards.map((d) => (
            <TileView key={d.id} tile={d} faceUp gold={gold} small
              className={lastDiscardedTileId === d.id ? "discard-arrive" : undefined}
            />
          ))}
        </div>
      )}
    </div>
    </>
  );
}
