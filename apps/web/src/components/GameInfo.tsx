import type { GoldState } from "@fuzhou-mahjong/shared";
import { TileView } from "./Tile";

interface GameInfoProps {
  gold: GoldState | null;
  wallRemaining: number;
  dealerIndex: number;
  lianZhuangCount: number;
  myIndex: number;
}

const POSITION_LABELS = ["下 (我)", "右", "上", "左"];

export function GameInfo({ gold, wallRemaining, dealerIndex, lianZhuangCount, myIndex }: GameInfoProps) {
  const dealerLabel = POSITION_LABELS[(dealerIndex - myIndex + 4) % 4];

  return (
    <div style={{
      textAlign: "center",
      padding: 12,
      background: "rgba(0,0,0,0.3)",
      borderRadius: 8,
    }}>
      <div style={{ marginBottom: 8 }}>
        <span style={{ color: "#aaa", fontSize: 12 }}>金牌 / Gold: </span>
        {gold && <TileView tile={gold.indicatorTile} faceUp gold={null} small />}
      </div>
      <div style={{ fontSize: 12, color: "#aaa" }}>
        剩余: {wallRemaining} | 庄: {dealerLabel} | 连庄: {lianZhuangCount}
      </div>
    </div>
  );
}
