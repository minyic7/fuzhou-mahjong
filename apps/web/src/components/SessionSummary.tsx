import { useState } from "react";
import type { GameOverResult } from "@fuzhou-mahjong/shared";
import { BREAKPOINTS } from "../hooks/useIsMobile";
import { useWindowSize } from "../hooks/useWindowSize";

interface RoundRecord {
  scores: number[];
  winnerId: number | null;
  winType: string;
}

export interface SessionData {
  playerNames: string[];
  cumulativeScores: number[];
  roundsPlayed: number;
  roundHistory: RoundRecord[];
}

interface SessionSummaryProps {
  data: SessionData;
  onClose: () => void;
}

const winTypeNames: Record<string, string> = {
  normal: "普通胡", tianHu: "天胡", grabGold: "抢金",
  pingHu0: "平胡(无花)", pingHu1: "平胡(一花)",
  threeGoldDown: "三金倒", goldSparrow: "金雀", goldDragon: "金龙",
  duiDuiHu: "对对胡", qingYiSe: "清一色", draw: "流局",
};

function RoundHistorySection({ roundHistory, playerNames, isCompact }: {
  roundHistory: RoundRecord[];
  playerNames: string[];
  isCompact: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const showToggle = isCompact;
  const contentMaxHeight = isCompact ? (expanded ? 150 : 0) : 160;

  return (
    <div style={{ marginBottom: "clamp(8px, 2.5dvh, 16px)" }}>
      <div
        style={{
          fontSize: "clamp(11px, 3dvh, 13px)", color: "var(--color-text-secondary)", marginBottom: "clamp(3px, 1dvh, 6px)",
          ...(showToggle ? { cursor: "pointer", userSelect: "none" as const } : {}),
        }}
        onClick={showToggle ? () => setExpanded(e => !e) : undefined}
      >
        每局记录 / Round History
        {showToggle && (
          <span style={{ marginLeft: 6, fontSize: "clamp(9px, 2.5dvh, 11px)" }}>
            {expanded ? "▲ 收起" : "▼ 展开"}
          </span>
        )}
      </div>
      {(!showToggle || expanded) && (
        <div style={{ maxHeight: contentMaxHeight, overflowY: "auto" }}>
          {/* Player name header */}
          <div style={{
            fontSize: "clamp(9px, 2.5dvh, 11px)", padding: "clamp(2px, 0.8dvh, 4px) clamp(6px, 1.8dvh, 10px)", marginBottom: 2,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            color: "var(--color-text-secondary)", opacity: 0.7,
          }}>
            <span />
            <span>
              {playerNames.map((name, i) => (
                <span key={i} style={{ marginLeft: "clamp(4px, 1.2dvh, 8px)", minWidth: "clamp(20px, 6dvh, 28px)", display: "inline-block", textAlign: "right" }}>
                  {name.length > 4 ? name.slice(0, 3) + "…" : name}
                </span>
              ))}
            </span>
          </div>
          {roundHistory.map((round, ri) => (
            <div key={ri} style={{
              fontSize: "clamp(10px, 2.8dvh, 12px)", padding: "clamp(3px, 1dvh, 6px) clamp(6px, 1.8dvh, 10px)", marginBottom: 2,
              background: "rgba(255,255,255,0.03)", borderRadius: 4,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ color: "var(--color-text-secondary)" }}>
                第{ri + 1}局: {winTypeNames[round.winType] || round.winType}
              </span>
              <span style={{ color: "var(--color-text-primary)" }}>
                {round.scores.map((s, i) => (
                  <span key={i} style={{
                    marginLeft: "clamp(4px, 1.2dvh, 8px)", minWidth: "clamp(20px, 6dvh, 28px)", display: "inline-block", textAlign: "right",
                    color: s > 0 ? "var(--color-success)" : s < 0 ? "var(--color-error)" : "var(--color-text-secondary)",
                    opacity: s === 0 ? 0.6 : 1,
                  }}>
                    {s > 0 ? "+" : ""}{s}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SessionSummary({ data, onClose }: SessionSummaryProps) {
  const { playerNames, cumulativeScores, roundsPlayed, roundHistory } = data;
  const { height } = useWindowSize();
  const isCompact = height <= BREAKPOINTS.COMPACT_HEIGHT;

  // Rankings sorted by cumulative score
  const rankings = cumulativeScores
    .map((score, i) => ({ name: playerNames[i] || `玩家${i}`, score, i }))
    .sort((a, b) => b.score - a.score);

  // MVP stats
  const winCounts = [0, 0, 0, 0];
  let highestRoundScore = -Infinity;
  let highestRoundPlayer = 0;
  for (const round of roundHistory) {
    if (round.winnerId != null) winCounts[round.winnerId]++;
    for (let i = 0; i < round.scores.length; i++) {
      if (round.scores[i] > highestRoundScore) {
        highestRoundScore = round.scores[i];
        highestRoundPlayer = i;
      }
    }
  }
  const mostWinsIdx = winCounts.indexOf(Math.max(...winCounts));
  const mostWins = winCounts[mostWinsIdx];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: "var(--z-portrait-overlay)" as any,
      background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "pageFadeIn 0.3s ease-out",
    }}>
      <div style={{
        background: "linear-gradient(135deg, var(--color-bg-dark) 0%, var(--color-bg-medium) 100%)",
        border: "1px solid rgba(255,215,0,0.3)",
        borderRadius: 12,
        padding: isCompact ? "clamp(8px, 2.5dvh, 16px) clamp(12px, 3dvh, 20px)" : "24px 28px",
        maxWidth: "min(440px, calc(100vw - 24px))",
        width: "90vw",
        maxHeight: "clamp(200px, 80dvh, 90dvh)",
        overflowY: "auto",
        color: "var(--color-text-primary)",
      }}>
        <h2 style={{ textAlign: "center", fontSize: isCompact ? "clamp(14px, 4.5dvh, 18px)" : 22, marginBottom: "clamp(2px, 0.8dvh, 4px)", color: "var(--color-gold-bright)" }}>
          本场总结 / Session Summary
        </h2>
        <div style={{ textAlign: "center", fontSize: "clamp(11px, 3dvh, 13px)", color: "var(--color-text-secondary)", marginBottom: "clamp(8px, 2.5dvh, 16px)" }}>
          共 {roundsPlayed} 局
        </div>

        {/* Final Rankings */}
        <div style={{ marginBottom: "clamp(8px, 2.5dvh, 16px)" }}>
          <div style={{ fontSize: "clamp(11px, 3dvh, 13px)", color: "var(--color-text-secondary)", marginBottom: "clamp(3px, 1dvh, 6px)" }}>最终排名 / Final Rankings</div>
          {rankings.map((p, rank) => (
            <div key={p.i} className="session-rank-row" style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "clamp(4px, 1.5dvh, 8px) clamp(8px, 2.5dvh, 14px)", marginBottom: "clamp(2px, 0.6dvh, 4px)", borderRadius: 6,
              background: rank === 0 ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.04)",
              border: rank === 0 ? "1px solid rgba(255,215,0,0.4)" : "1px solid transparent",
            }}>
              <span style={{ fontSize: rank === 0 ? "clamp(13px, 3.8dvh, 16px)" : "clamp(11px, 3.2dvh, 14px)" }}>
                {rank === 0 ? "👑 " : `${rank + 1}. `}
                {p.name}
              </span>
              <span style={{
                fontWeight: "bold", fontSize: rank === 0 ? "clamp(14px, 4dvh, 18px)" : "clamp(11px, 3.2dvh, 14px)",
                color: p.score > 0 ? "var(--color-gold-bright)" : p.score < 0 ? "var(--color-error)" : "var(--color-text-secondary)",
              }}>
                {p.score > 0 ? "+" : ""}{p.score}
              </span>
            </div>
          ))}
        </div>

        {/* MVP Stats */}
        {roundHistory.length > 0 && (
          <div style={{
            marginBottom: "clamp(8px, 2.5dvh, 16px)", padding: "clamp(6px, 1.8dvh, 10px)",
            background: "rgba(255,255,255,0.04)", borderRadius: 6,
          }}>
            <div style={{ fontSize: "clamp(11px, 3dvh, 13px)", color: "var(--color-text-secondary)", marginBottom: "clamp(3px, 1dvh, 6px)" }}>数据亮点 / Highlights</div>
            {mostWins > 0 && (
              <div style={{ fontSize: "clamp(11px, 3dvh, 13px)", color: "var(--color-text-warm)", marginBottom: "clamp(2px, 0.6dvh, 4px)" }}>
                🏆 最多胜场: {playerNames[mostWinsIdx]} ({mostWins}胡)
              </div>
            )}
            {highestRoundScore > 0 && (
              <div style={{ fontSize: "clamp(11px, 3dvh, 13px)", color: "var(--color-text-warm)" }}>
                🎯 单局最高: {playerNames[highestRoundPlayer]} (+{highestRoundScore})
              </div>
            )}
          </div>
        )}

        {/* Per-round history */}
        {roundHistory.length > 0 && (
          <RoundHistorySection
            roundHistory={roundHistory}
            playerNames={playerNames}
            isCompact={isCompact}
          />
        )}

        <button
          onClick={onClose}
          style={{
            position: "sticky", bottom: 0,
            width: "100%", padding: "clamp(8px, 2.5dvh, 12px) 0", fontSize: "clamp(13px, 3.5dvh, 16px)",
            background: "var(--color-bg-button)", color: "var(--color-text-primary)",
            border: "1px solid rgba(255,215,0,0.3)",
            borderRadius: 6, cursor: "pointer",
            minHeight: "max(var(--btn-min-size), 9dvh)",
          }}
        >
          返回大厅 / Back to Lobby
        </button>
      </div>
    </div>
  );
}
