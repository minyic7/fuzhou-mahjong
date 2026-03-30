import { useMemo, useState, useEffect, useRef } from "react";
import type { GoldState } from "@fuzhou-mahjong/shared";
import { TileView } from "./Tile";
import { TILE_BACK_URL } from "../tileSvg";

type Side = "top" | "right" | "bottom" | "left";

interface TileWallProps {
  wallRemaining: number;
  wallDrawCount: number;
  wallSupplementCount: number;
  gold: GoldState | null;
  canDraw?: boolean;
  onDraw?: () => void;
  compact?: boolean;
  /** Render only this side as a standalone strip (for edge placement). */
  segment?: Side;
}

const STACKS_PER_SIDE = 18;
const TOTAL_STACKS = STACKS_PER_SIDE * 4;

interface StackState { hasUpper: boolean; hasLower: boolean; }

const SIDES: Side[] = ["top", "right", "bottom", "left"];

/**
 * Given actual draw and supplement counts from the server,
 * compute which stacks still have tiles.
 * Draw end depletes from head (stack 0 forward), supplement from tail (stack 71 backward).
 */
function computeWallStacks(drawCount: number, supplementCount: number): StackState[][] {
  const stacks: StackState[] = Array.from({ length: TOTAL_STACKS }, () => ({
    hasUpper: true, hasLower: true,
  }));

  // Remove from draw end (head): upper first at each stack, then lower
  let rem = drawCount;
  for (let i = 0; i < TOTAL_STACKS && rem > 0; i++) {
    if (stacks[i].hasUpper) { stacks[i].hasUpper = false; rem--; }
    if (rem > 0 && stacks[i].hasLower) { stacks[i].hasLower = false; rem--; }
  }

  // Remove from supplement end (tail): upper first, then lower
  rem = supplementCount;
  for (let i = TOTAL_STACKS - 1; i >= 0 && rem > 0; i--) {
    if (stacks[i].hasUpper) { stacks[i].hasUpper = false; rem--; }
    if (rem > 0 && stacks[i].hasLower) { stacks[i].hasLower = false; rem--; }
  }

  return [
    stacks.slice(0, STACKS_PER_SIDE),
    stacks.slice(STACKS_PER_SIDE, STACKS_PER_SIDE * 2),
    stacks.slice(STACKS_PER_SIDE * 2, STACKS_PER_SIDE * 3),
    stacks.slice(STACKS_PER_SIDE * 3),
  ];
}

/** Find first stack from head that still has a tile (= draw position). */
function findDrawStackIndex(sides: StackState[][]): { side: number; stack: number } | null {
  const flat = sides.flat();
  for (let i = 0; i < flat.length; i++) {
    if (flat[i].hasUpper || flat[i].hasLower) {
      return { side: Math.floor(i / STACKS_PER_SIDE), stack: i % STACKS_PER_SIDE };
    }
  }
  return null;
}

function WallTile() {
  return (
    <div style={{
      width: "var(--wall-tw)",
      height: "var(--wall-th)",
      borderRadius: 2,
      borderBottom: "1.5px solid var(--color-tile-back-border)",
      borderRight: "1px solid var(--color-tile-back-border-right)",
      overflow: "hidden",
      boxShadow: "0 1px 2px rgba(0,0,0,0.35)",
      flexShrink: 0,
      transition: "opacity 0.25s ease-out, transform 0.25s ease-out",
    }}>
      <img src={TILE_BACK_URL} alt="" style={{ width: "100%", height: "100%", display: "block" }} loading="lazy" draggable={false} />
    </div>
  );
}

function WallSegment({ side, stacks, drawStack, canDraw, onDraw, standalone }: {
  side: Side;
  stacks: StackState[];
  drawStack: number | null;
  canDraw?: boolean;
  onDraw?: () => void;
  /** When true, renders as flow element (no absolute positioning). */
  standalone?: boolean;
}) {
  const isH = side === "top" || side === "bottom";
  // Reverse order for bottom and left so depletion visually proceeds correctly
  const ordered = side === "bottom" || side === "left" ? [...stacks].reverse() : stacks;
  const drawIdx = drawStack !== null
    ? (side === "bottom" || side === "left" ? stacks.length - 1 - drawStack : drawStack)
    : null;

  return (
    <div className={`wall-segment wall-${side}`} style={{
      display: "flex",
      flexDirection: isH ? "row" : "column",
      gap: 0,
      ...(!standalone && {
        position: "absolute" as const,
        ...(side === "top" && { top: 0, left: "50%", transform: "translateX(-50%)" }),
        ...(side === "bottom" && { bottom: 0, left: "50%", transform: "translateX(-50%)" }),
        ...(side === "left" && { left: 0, top: "50%", transform: "translateY(-50%)" }),
        ...(side === "right" && { right: 0, top: "50%", transform: "translateY(-50%)" }),
      }),
    }}>
      {ordered.map((s, i) => {
        const isTarget = drawIdx === i;
        return (
          <div key={i} style={{
            position: "relative",
            width: isH ? "var(--wall-tw)" : "calc(var(--wall-th) + var(--wall-tw) * 0.4)",
            height: isH ? "calc(var(--wall-th) + var(--wall-tw) * 0.4)" : "var(--wall-tw)",
            flexShrink: 0,
          }}>
            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: isH ? "column" : "row",
              justifyContent: "flex-end",
              ...(!isH && { transform: "rotate(90deg)", transformOrigin: "center" }),
            }}>
              {/* Lower tile */}
              <div style={{
                position: "absolute", bottom: 0, left: 0,
                opacity: s.hasLower ? 1 : 0,
                transform: s.hasLower ? "scale(1)" : "scale(0.5)",
                transition: "opacity 0.15s ease-out, transform 0.15s ease-out",
                pointerEvents: s.hasLower ? "auto" : "none",
              }}>
                <WallTile />
              </div>
              {/* Upper tile, offset slightly */}
              <div style={{
                position: "absolute", bottom: "min(3px, calc(var(--wall-tw) * 0.4))", left: 0,
                opacity: s.hasUpper ? 1 : 0,
                transform: s.hasUpper ? "scale(1)" : "scale(0.5)",
                transition: "opacity 0.15s ease-out, transform 0.15s ease-out",
                pointerEvents: s.hasUpper ? "auto" : "none",
              }}>
                <WallTile />
              </div>
            </div>
            {/* Draw button on the draw-target stack */}
            {isTarget && canDraw && (
              <button
                className="draw-button-pulse"
                onClick={onDraw}
                style={{
                  position: "absolute",
                  top: "50%", left: "50%",
                  transform: "translate(-50%, -50%)",
                  padding: "var(--btn-padding)",
                  fontSize: "var(--btn-font)",
                  fontWeight: "bold",
                  background: "var(--color-draw-action)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  boxShadow: "0 0 12px rgba(106,90,205,0.6)",
                  whiteSpace: "nowrap",
                  minHeight: "var(--btn-min-size)",
                  minWidth: "var(--btn-min-size)",
                  zIndex: "var(--z-draw-button)",
                }}
              >
                摸牌
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TileWall({ wallRemaining, wallDrawCount, wallSupplementCount, gold, canDraw, onDraw, compact, segment }: TileWallProps) {
  const sides = useMemo(() => computeWallStacks(wallDrawCount, wallSupplementCount), [wallDrawCount, wallSupplementCount]);
  const drawIndex = useMemo(() => findDrawStackIndex(sides), [sides]);

  const [goldFlip, setGoldFlip] = useState(false);
  const prevGoldRef = useRef<number | null>(null);

  useEffect(() => {
    if (gold) {
      const key = gold.indicatorTile.id;
      if (prevGoldRef.current !== key) {
        prevGoldRef.current = key;
        setGoldFlip(true);
      }
    } else {
      prevGoldRef.current = null;
      setGoldFlip(false);
    }
  }, [gold]);

  // Single segment mode — render one standalone wall strip
  if (segment) {
    const sideIndex = SIDES.indexOf(segment);
    return (
      <WallSegment
        side={segment}
        stacks={sides[sideIndex]}
        drawStack={drawIndex?.side === sideIndex ? drawIndex.stack : null}
        canDraw={canDraw}
        onDraw={onDraw}
        standalone
      />
    );
  }

  if (compact) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 8, padding: "4px 8px", maxHeight: "var(--btn-min-size)",
        background: "rgba(0,0,0,0.2)", borderRadius: 6,
      }}>
        {gold && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: "var(--font-xs)", color: "var(--color-gold-bright)" }}>金</span>
            <TileView tile={gold.indicatorTile} faceUp gold={null} small className={goldFlip ? "gold-flip-reveal" : undefined} />
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: "var(--wall-progress-w)", height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3 }}>
            <div style={{
              width: `${(wallRemaining / 144) * 100}%`, height: "100%",
              background: wallRemaining > 20 ? "var(--color-success)" : wallRemaining > 10 ? "var(--color-accent-orange)" : "var(--color-error)",
              borderRadius: 3, transition: "width 0.3s ease",
            }} />
          </div>
          <span style={{ fontSize: "var(--font-sm)", color: "var(--color-text-secondary)" }}>{wallRemaining}</span>
        </div>
        {canDraw && (
          <button
            className="draw-button-pulse"
            onClick={onDraw}
            style={{
              padding: "var(--btn-padding)", fontSize: "var(--btn-font)", fontWeight: "bold",
              background: "var(--color-draw-action)", color: "#fff", border: "none",
              borderRadius: 4, minHeight: "var(--btn-min-size)", minWidth: "var(--btn-min-size)",
              boxShadow: "0 0 12px rgba(106,90,205,0.6)",
            }}
          >
            摸牌
          </button>
        )}
      </div>
    );
  }

  // Full square mode (legacy — kept for reference, no longer used from GameTable)
  return (
    <div className="tile-wall-container" style={{
      position: "relative",
      width: "calc(var(--wall-tw) * 18 + 2 * var(--wall-th) + max(4px, calc(var(--wall-th) * 1.7)))",
      height: "calc(var(--wall-tw) * 18 + 2 * var(--wall-th) + max(4px, calc(var(--wall-th) * 1.7)))",
      margin: "0 auto",
      flexShrink: 0,
    }}>
      {SIDES.map((side, i) => (
        <WallSegment
          key={side}
          side={side}
          stacks={sides[i]}
          drawStack={drawIndex?.side === i ? drawIndex.stack : null}
          canDraw={canDraw}
          onDraw={onDraw}
        />
      ))}

      {/* Center: gold indicator */}
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}>
        {gold && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: "var(--font-xs)", color: "var(--color-gold-bright)", marginBottom: 2 }}>金</div>
            <TileView tile={gold.indicatorTile} faceUp gold={null} small className={goldFlip ? "gold-flip-reveal" : undefined} />
          </div>
        )}
        {wallRemaining <= 10 && (
          <div
            className="wall-low-pulse"
            style={{
              fontSize: "var(--font-sm)",
              color: "var(--color-error)",
              padding: "2px 6px",
              borderRadius: 4,
              background: "rgba(244,67,54,0.15)",
            }}
          >
            牌墙将尽
          </div>
        )}
      </div>
    </div>
  );
}
