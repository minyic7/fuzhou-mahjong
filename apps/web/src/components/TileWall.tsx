import { useEffect, useRef, useState } from "react";
import type { GoldState } from "@fuzhou-mahjong/shared";
import { TileView } from "./Tile";

interface TileWallProps {
  wallRemaining: number;
  gold: GoldState | null;
  canDraw?: boolean;
  onDraw?: () => void;
}

export function TileWall({ wallRemaining, gold, canDraw, onDraw }: TileWallProps) {
  const prevRef = useRef(wallRemaining);
  const [flash, setFlash] = useState(false);

  // Flash animation when a tile is drawn
  useEffect(() => {
    if (wallRemaining < prevRef.current) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 400);
      prevRef.current = wallRemaining;
      return () => clearTimeout(t);
    }
    prevRef.current = wallRemaining;
  }, [wallRemaining]);

  // Distribute tiles exactly across 4 walls (top, right, bottom, left)
  const base = Math.floor(wallRemaining / 4);
  const extra = wallRemaining % 4;
  const wallTiles: [number, number, number, number] = [
    base + (extra > 0 ? 1 : 0), // top (draw side)
    base + (extra > 1 ? 1 : 0), // right
    base + (extra > 2 ? 1 : 0), // bottom (tail side)
    base + (extra > 3 ? 1 : 0), // left
  ];

  const renderWall = (tileCount: number, side: "top" | "bottom" | "left" | "right") => {
    const isH = side === "top" || side === "bottom";
    const isDrawSide = side === "top"; // head side for drawing

    return (
      <div style={{
        display: "flex",
        flexDirection: isH ? "row" : "column",
        justifyContent: "center",
        gap: 1,
        position: "absolute" as const,
        transition: "all 0.5s ease-out",
        ...(side === "top" && { top: 0, left: "50%", transform: "translateX(-50%)" }),
        ...(side === "bottom" && { bottom: 0, left: "50%", transform: "translateX(-50%)" }),
        ...(side === "left" && { left: 0, top: "50%", transform: "translateY(-50%)" }),
        ...(side === "right" && { right: 0, top: "50%", transform: "translateY(-50%)" }),
      }}>
        {Array.from({ length: tileCount }).map((_, i) => {
          const isEdgeTile = isDrawSide && i === tileCount - 1;
          return (
            <div
              key={`${side}-${i}`}
              style={{
                width: isH ? 6 : 14,
                height: isH ? 14 : 6,
                background: isEdgeTile && flash
                  ? "rgba(255,215,0,0.6)"
                  : "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)",
                border: "1px solid #1a3c2a",
                borderRadius: 1,
                borderBottom: isH ? "2px solid #0d3320" : undefined,
                borderRight: !isH ? "2px solid #0d3320" : undefined,
                transition: "all 0.3s ease-out",
                transform: isEdgeTile && flash ? "scale(0.5)" : "scale(1)",
                opacity: isEdgeTile && flash ? 0 : 1,
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div style={{
      position: "relative",
      width: 220,
      height: 220,
      margin: "0 auto",
      flexShrink: 0,
    }}>
      {renderWall(wallTiles[0], "top")}
      {renderWall(wallTiles[1], "right")}
      {renderWall(wallTiles[2], "bottom")}
      {renderWall(wallTiles[3], "left")}

      {/* Center: gold + remaining */}
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
            <div style={{ fontSize: 10, color: "#ffd700", marginBottom: 2 }}>金</div>
            <TileView tile={gold.indicatorTile} faceUp gold={null} small />
          </div>
        )}
        <div
          className={wallRemaining <= 20 ? "wall-low-pulse" : ""}
          style={{
            fontSize: wallRemaining <= 10 ? 22 : wallRemaining <= 20 ? 20 : 18,
            fontWeight: "bold",
            color: wallRemaining <= 10 ? "#f44336" : wallRemaining <= 20 ? "#ffa726" : "#8fbc8f",
            padding: "4px 12px",
            borderRadius: 6,
            background: wallRemaining <= 10
              ? "rgba(244,67,54,0.15)"
              : wallRemaining <= 20
              ? "rgba(255,167,38,0.12)"
              : "transparent",
            border: wallRemaining <= 20
              ? `1px solid ${wallRemaining <= 10 ? "rgba(244,67,54,0.4)" : "rgba(255,167,38,0.3)"}`
              : "1px solid transparent",
            transition: "all 0.3s ease",
          }}
        >
          余 {wallRemaining}
        </div>
      </div>

      {/* Direction labels / Draw button */}
      {canDraw ? (
        <button
          className="draw-button-pulse"
          onClick={onDraw}
          style={{
            position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
            padding: "6px 16px", fontSize: 14, fontWeight: "bold",
            background: "#6a5acd", color: "#fff", border: "none", borderRadius: 6,
            boxShadow: "0 0 12px rgba(106,90,205,0.6)",
            whiteSpace: "nowrap", minHeight: 44, minWidth: 44,
            zIndex: 10,
          }}
        >
          摸牌
        </button>
      ) : (
        <div style={{ position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "#8a9a8a" }}>摸牌 →</div>
      )}
      <div style={{ position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "#8a9a8a" }}>← 补牌</div>
    </div>
  );
}
