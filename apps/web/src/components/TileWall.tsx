import type { GoldState } from "@fuzhou-mahjong/shared";
import { TileView } from "./Tile";

interface TileWallProps {
  wallRemaining: number;
  gold: GoldState | null;
}

const TOTAL_TILES = 144;
const TILES_PER_WALL = 36; // each wall has 18 stacks × 2 tiles

export function TileWall({ wallRemaining, gold }: TileWallProps) {
  // Distribute remaining tiles across 4 walls (simplified)
  const tilesPerSide = Math.ceil(wallRemaining / 4);
  const stacksPerSide = Math.ceil(tilesPerSide / 2);

  const wallStyle = (side: "top" | "bottom" | "left" | "right"): React.CSSProperties => {
    const isHorizontal = side === "top" || side === "bottom";
    return {
      display: "flex",
      flexDirection: isHorizontal ? "row" : "column",
      justifyContent: "center",
      gap: 1,
      position: "absolute" as const,
      ...(side === "top" && { top: 0, left: "50%", transform: "translateX(-50%)" }),
      ...(side === "bottom" && { bottom: 0, left: "50%", transform: "translateX(-50%)" }),
      ...(side === "left" && { left: 0, top: "50%", transform: "translateY(-50%)" }),
      ...(side === "right" && { right: 0, top: "50%", transform: "translateY(-50%)" }),
    };
  };

  const renderWall = (stacks: number, side: "top" | "bottom" | "left" | "right") => {
    const isHorizontal = side === "top" || side === "bottom";
    return (
      <div style={wallStyle(side)}>
        {Array.from({ length: Math.min(stacks, 18) }).map((_, i) => (
          <div
            key={i}
            style={{
              width: isHorizontal ? 10 : 16,
              height: isHorizontal ? 16 : 10,
              background: "#2a5c3a",
              border: "1px solid #1a3c2a",
              borderRadius: 1,
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div style={{
      position: "relative",
      width: 220,
      height: 220,
      margin: "0 auto",
    }}>
      {renderWall(stacksPerSide, "top")}
      {renderWall(stacksPerSide, "right")}
      {renderWall(stacksPerSide, "bottom")}
      {renderWall(stacksPerSide, "left")}

      {/* Center: gold indicator + info */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        textAlign: "center",
      }}>
        {gold && (
          <div style={{ marginBottom: 4 }}>
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
          }}
        >
          余 {wallRemaining}
        </div>
      </div>

      {/* Labels */}
      <div style={{ position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "#8a9a8a" }}>摸牌 →</div>
      <div style={{ position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "#8a9a8a" }}>← 补牌</div>
    </div>
  );
}
