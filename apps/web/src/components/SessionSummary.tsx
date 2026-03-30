import type { GameOverResult } from "@fuzhou-mahjong/shared";
import { BREAKPOINTS } from "../hooks/useIsMobile";

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

export function SessionSummary({ data, onClose }: SessionSummaryProps) {
  const { playerNames, cumulativeScores, roundsPlayed, roundHistory } = data;
  const isCompact = window.innerHeight <= BREAKPOINTS.COMPACT_HEIGHT;

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
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "pageFadeIn 0.3s ease-out",
    }}>
      <div style={{
        background: "linear-gradient(135deg, var(--color-bg-dark) 0%, var(--color-bg-medium) 100%)",
        border: "1px solid rgba(255,215,0,0.3)",
        borderRadius: 12,
        padding: isCompact ? "16px 20px" : "24px 28px",
        maxWidth: 440,
        width: "90vw",
        maxHeight: "90dvh",
        overflowY: "auto",
        color: "var(--color-text-primary)",
      }}>
        <h2 style={{ textAlign: "center", fontSize: isCompact ? 18 : 22, marginBottom: 4, color: "var(--color-gold-bright)" }}>
          本场总结 / Session Summary
        </h2>
        <div style={{ textAlign: "center", fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 16 }}>
          共 {roundsPlayed} 局
        </div>

        {/* Final Rankings */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 6 }}>最终排名 / Final Rankings</div>
          {rankings.map((p, rank) => (
            <div key={p.i} className="session-rank-row" style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 14px", marginBottom: 4, borderRadius: 6,
              background: rank === 0 ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.04)",
              border: rank === 0 ? "1px solid rgba(255,215,0,0.4)" : "1px solid transparent",
            }}>
              <span style={{ fontSize: rank === 0 ? 16 : 14 }}>
                {rank === 0 ? "👑 " : `${rank + 1}. `}
                {p.name}
              </span>
              <span style={{
                fontWeight: "bold", fontSize: rank === 0 ? 18 : 14,
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
            marginBottom: 16, padding: 10,
            background: "rgba(255,255,255,0.04)", borderRadius: 6,
          }}>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 6 }}>数据亮点 / Highlights</div>
            {mostWins > 0 && (
              <div style={{ fontSize: 13, color: "var(--color-text-warm)", marginBottom: 4 }}>
                🏆 最多胜场: {playerNames[mostWinsIdx]} ({mostWins}胡)
              </div>
            )}
            {highestRoundScore > 0 && (
              <div style={{ fontSize: 13, color: "var(--color-text-warm)" }}>
                🎯 单局最高: {playerNames[highestRoundPlayer]} (+{highestRoundScore})
              </div>
            )}
          </div>
        )}

        {/* Per-round history */}
        {roundHistory.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 6 }}>每局记录 / Round History</div>
            <div style={{ maxHeight: isCompact ? 100 : 160, overflowY: "auto" }}>
              {roundHistory.map((round, ri) => (
                <div key={ri} style={{
                  fontSize: 12, padding: "6px 10px", marginBottom: 2,
                  background: "rgba(255,255,255,0.03)", borderRadius: 4,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ color: "var(--color-text-secondary)" }}>
                    第{ri + 1}局: {winTypeNames[round.winType] || round.winType}
                  </span>
                  <span style={{ color: "var(--color-text-primary)" }}>
                    {round.scores.map((s, i) => (
                      <span key={i} style={{
                        marginLeft: 8,
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
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            position: "sticky", bottom: 0,
            width: "100%", padding: "12px 0", fontSize: 16,
            background: "var(--color-bg-button)", color: "var(--color-text-primary)",
            border: "1px solid rgba(255,215,0,0.3)",
            borderRadius: 6, cursor: "pointer",
          }}
        >
          返回大厅 / Back to Lobby
        </button>
      </div>
    </div>
  );
}
