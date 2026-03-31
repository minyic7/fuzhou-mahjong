import type { GameOverResult, ClientGameState } from "@fuzhou-mahjong/shared";
import { MeldType } from "@fuzhou-mahjong/shared";
import { TileView } from "./Tile";
import { Button } from "./Button";
import { SessionSummary, type SessionData } from "./SessionSummary";

interface MobileGameOverModalProps {
  gameOver: GameOverResult;
  gameState: ClientGameState;
  winTypeNames: Record<string, string>;
  sessionSummary: SessionData | null;
  onNextRound: () => void;
  onLeaveOrShowSummary: () => void;
  onSessionSummaryClose: () => void;
  onLeave?: () => void;
}

export function MobileGameOverModal({
  gameOver: go,
  gameState,
  winTypeNames,
  sessionSummary,
  onNextRound,
  onLeaveOrShowSummary,
  onSessionSummaryClose,
  onLeave,
}: MobileGameOverModalProps) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: "var(--z-game-over)" as any,
      background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "overlayFadeIn 0.3s ease-out",
    }}>
      <div style={{
        background: "var(--overlay-bg)",
        border: "2px solid var(--color-gold-border-hover)",
        borderRadius: "var(--radius-lg)",
        padding: "8px 12px",
        maxWidth: "min(340px, 92vw)", width: "92vw",
        maxHeight: "80dvh", overflowY: "auto",
        textAlign: "center",
        animation: "overlayScaleIn 0.3s ease-out",
      }}>
        {/* Winner announcement */}
        <h2 style={{ fontSize: "clamp(14px, 4.5dvh, 22px)", marginBottom: "clamp(2px, 1dvh, 6px)" }}>
          {go.winnerId !== null
            ? `🎉 ${(go.playerNames ?? [])[go.winnerId] || "玩家"} 胡了!`
            : "流局 / Draw"}
        </h2>

        {/* Win type */}
        <p style={{ fontSize: "clamp(11px, 3dvh, 15px)", color: "var(--color-text-gold)", marginBottom: "clamp(4px, 1.5dvh, 10px)" }}>
          {winTypeNames[go.winType] || go.winType}
        </p>

        {/* Winning hand tiles */}
        {go.winnerId !== null && go.allHands?.[go.winnerId] && (() => {
          const winnerHand = go.allHands[go.winnerId!];
          const meldTileCount = winnerHand.melds.reduce((s, m) => s + m.tiles.length, 0);
          const totalTiles = meldTileCount + winnerHand.hand.length + winnerHand.flowers.length;
          const meldGaps = winnerHand.melds.length * 4;
          const flowerGap = winnerHand.flowers.length > 0 ? 6 : 0;
          const tileGaps = Math.max(0, totalTiles - 1) * 1;
          const usableWidth = 280;
          const maxTileW = Math.max(12, Math.floor((usableWidth - meldGaps - flowerGap - tileGaps) / totalTiles));
          const tileW = Math.min(maxTileW, 22);
          const tileH = Math.round(tileW * 4 / 3);
          const tileStyle = { width: tileW, height: tileH };
          return (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center", marginBottom: "clamp(4px, 1.5dvh, 10px)" }}>
              {winnerHand.melds.map((m, mi) => (
                <div key={`m${mi}`} style={{ display: "flex", gap: 1 }}>
                  {m.tiles.map((t) => (
                    <TileView key={t.id} tile={t} faceUp={m.type !== MeldType.AnGang} small gold={gameState?.gold} style={tileStyle} />
                  ))}
                </div>
              ))}
              {winnerHand.hand.map(t => (
                <TileView key={t.id} tile={t} faceUp small gold={gameState?.gold} style={tileStyle} />
              ))}
              {winnerHand.flowers.length > 0 && (
                <div style={{ display: "flex", gap: 1, marginLeft: 4 }}>
                  {winnerHand.flowers.map(t => (
                    <TileView key={t.id} tile={t} faceUp small style={tileStyle} />
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Score breakdown */}
        {go.breakdown && go.winnerId !== null && (
          <div className="score-breakdown">
            <div style={{ fontSize: "clamp(9px, 2.5dvh, 11px)", color: "var(--color-text-secondary)", marginBottom: "clamp(1px, 0.5dvh, 3px)" }}>得分明细</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(2px, 0.6dvh, 4px) clamp(4px, 1.5dvh, 10px)", justifyContent: "center", fontSize: "clamp(10px, 2.8dvh, 12px)", color: "var(--color-text-primary)" }}>
              <span>花分: {go.breakdown.flowerScore}</span>
              <span>金: {go.breakdown.goldScore}</span>
              <span>连庄: {go.breakdown.lianZhuangCount}</span>
              <span>特殊: {go.breakdown.specialMultiplier}x</span>
            </div>
            <div style={{ fontSize: "clamp(11px, 3dvh, 13px)", color: "var(--color-text-gold)", marginTop: "clamp(1px, 0.5dvh, 3px)" }}>
              总分: {go.breakdown.totalScore}
            </div>
          </div>
        )}

        {/* Round scores */}
        <div style={{ marginBottom: "clamp(4px, 1.5dvh, 10px)" }}>
          {go.scores
            .map((score, i) => ({ name: (go.playerNames ?? [])[i] || `玩家${i}`, score, i }))
            .sort((a, b) => b.score - a.score)
            .map((p, rank) => (
              <div key={p.i} className={`score-row${p.score > 0 ? " positive" : p.score < 0 ? " negative" : ""}${rank === 0 && p.score > 0 ? " top-positive" : ""}`}
                style={{ animation: `scoreReveal 0.3s ease-out ${rank * 0.1}s both` }}>
                <span>{rank === 0 && p.score > 0 ? "🏆 " : `${rank + 1}. `}{p.name}</span>
                <span style={{ fontWeight: "bold", color: p.score > 0 ? "var(--color-success)" : p.score < 0 ? "var(--color-error)" : "var(--color-text-secondary)" }}>
                  {p.score > 0 ? "+" : ""}{p.score}
                </span>
              </div>
            ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "clamp(6px, 2dvh, 12px)", justifyContent: "center", flexWrap: "wrap" }}>
          <Button variant="gold" size="lg" onClick={onNextRound} style={{ minHeight: 48 }}>
            下一局 / Next Round
          </Button>
          {onLeave && (
            <Button variant="secondary" size="lg" onClick={onLeaveOrShowSummary} style={{ minHeight: 48 }}>
              离开 / Leave
            </Button>
          )}
        </div>
      </div>

      {/* SessionSummary overlay */}
      {sessionSummary && (
        <SessionSummary
          data={sessionSummary}
          onClose={onSessionSummaryClose}
        />
      )}
    </div>
  );
}
