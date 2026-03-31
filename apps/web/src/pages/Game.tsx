import { GameTable } from "../components/GameTable";
import { ClaimOverlay } from "../components/ClaimOverlay";
import { CenterAction } from "../components/CenterAction";
import { TileCounter } from "../components/TileCounter";
import { TutorialModal } from "../components/TutorialModal";
import { TileView } from "../components/Tile";
import { SessionSummary } from "../components/SessionSummary";
import { Button } from "../components/Button";
import { MeldType } from "@fuzhou-mahjong/shared";
import type { ClientGameState } from "@fuzhou-mahjong/shared";
import { useGameLogic } from "../hooks/useGameLogic";

interface GameProps {
  initialGameState?: ClientGameState | null;
  onLeave?: () => void;
}

export function Game({ initialGameState, onLeave }: GameProps) {
  const game = useGameLogic({ initialGameState, onLeave });

  if (!game.gameState) {
    return <div className="loading-state" style={{ minHeight: "80dvh" }}><div className="spinner" />等待游戏数据...</div>;
  }

  return (
    <div className="game-wrapper">
      {game.isPortrait && (
        <div className="portrait-rotate-overlay">
          <div className="portrait-title">福州麻将</div>
          <div className="portrait-phone-icon phone-rotate-icon">📱</div>
          <div className="portrait-msg">
            请将手机横屏以获得最佳体验
          </div>
          <div className="portrait-hint">
            Please rotate your device to landscape mode.
            The game table requires a wider screen to display properly.
          </div>
        </div>
      )}
      {game.showFlash && (
        <>
          <div className="screen-flash" />
          <div className="border-flash" />
        </>
      )}
      {/* Toast notifications */}
      <div className={`game-toast-container${game.isCompactMain ? ' compact' : ''}`}>
        {game.toasts.map((t) => (
          <div key={t.id} className="game-toast">
            {t.message}
          </div>
        ))}
      </div>
      <CenterAction display={game.centerAction} gold={game.gameState.gold} />
      <GameTable
        state={game.gameState}
        onTileSelect={game.handleTileSelect}
        onTileDoubleClick={game.handleTileDoubleClick}
        selectedTileId={game.selectedTileId}
        claimableTileIds={game.claimableTileIds}
        canDiscard={game.effectiveCanDiscard}
        onDiscard={game.handleDiscardById}
        canHu={game.canHuSelf}
        onHu={game.handleHu}
        canDraw={game.canDraw}
        onDraw={game.handleDraw}
        kongTileIds={game.kongTileIds}
        onAnGang={game.handleAnGang}
        onBuGang={game.handleBuGang}
        onBackgroundClick={game.handleBackgroundClick}
        disconnectedPlayers={game.disconnectedPlayers}
        drawAnimation={game.drawAnimation}
        claimAnimation={game.claimAnimation}
        departingTile={game.departingTile}
        revealedHands={game.gameOver?.allHands ?? null}
        claimActive={game.isClaimWindow}
      />
      {game.isClaimWindow && game.actions && (
        <ClaimOverlay actions={game.actions} gameState={game.gameState} onAction={game.handleAction} />
      )}
      {/* Floating tile counter overlay */}
      <div style={{ position: "fixed", bottom: "calc(12px + env(safe-area-inset-bottom, 0px))", left: "calc(12px + env(safe-area-inset-left, 0px))", zIndex: "var(--z-tile-counter)" }}>
        <TileCounter gameState={game.gameState} />
      </div>
      {/* Settings gear button + dropdown */}
      <div ref={game.settingsRef} style={{
        position: 'fixed',
        top: 'calc(8px + env(safe-area-inset-top, 0px))',
        right: 'calc(8px + env(safe-area-inset-right, 0px))',
        zIndex: "var(--z-settings-btn)" as any,
      }}>
        <button
          onClick={() => game.setSettingsOpen((v) => !v)}
          aria-label="Settings"
          style={{
            width: "var(--btn-min-size)", height: "var(--btn-min-size)", minHeight: "var(--btn-min-size)", borderRadius: "50%",
            background: "var(--overlay-bg)", border: "1px solid var(--color-gold-border-hover)",
            color: "var(--color-text-secondary)", fontSize: 20, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", padding: 0,
          }}
        >⚙</button>
        {game.settingsOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: "var(--z-settings-dropdown)" as any,
            background: 'var(--overlay-bg)', border: '1px solid var(--color-gold-border-hover)',
            borderRadius: 'var(--radius-md)', padding: 4, minWidth: "clamp(120px, 35vw, 160px)",
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            <Button
              variant="secondary"
              size="sm"
              style={{ justifyContent: 'flex-start', width: '100%', border: 'none' }}
              onClick={game.handleOpenFullTutorial}
            >📖 规则说明</Button>
            <Button
              variant="secondary"
              size="sm"
              style={{ justifyContent: 'flex-start', width: '100%', border: 'none' }}
              onClick={game.handleToggleMute}
            >{game.muted ? '🔇' : '🔊'} 音效{game.muted ? '开启' : '关闭'}</Button>
            {game.onLeave && (
              <Button
                variant="danger"
                size="sm"
                style={{ justifyContent: 'flex-start', width: '100%', border: 'none' }}
                onClick={game.handleRequestLeave}
              >🚪 退出游戏</Button>
            )}
          </div>
        )}
      </div>
      {/* Leave confirmation modal */}
      {game.showLeaveConfirm && (
        <div className="confirm-modal-backdrop">
          <div className="confirm-modal">
            <p className="confirm-modal-title">确定要退出吗？</p>
            <p className="confirm-modal-subtitle">退出后本局将由机器人代打</p>
            <div className="confirm-modal-actions">
              <Button variant='secondary' onClick={() => game.setShowLeaveConfirm(false)}>取消</Button>
              <Button variant='danger' onClick={game.handleConfirmLeave}>退出游戏</Button>
            </div>
          </div>
        </div>
      )}
      <TutorialModal
        open={game.showTutorial}
        onClose={() => game.setShowTutorial(false)}
        condensed={game.tutorialCondensed}
      />
      {/* Game-over modal overlay — shows on top of the game table */}
      {game.gameOver && (() => {
        const go = game.gameOver!;
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
            padding: "clamp(8px, 2.5dvh, 16px) clamp(12px, 3dvh, 20px)",
            maxWidth: "min(360px, 90vw)", width: "90vw",
            maxHeight: "clamp(200px, 80dvh, 90dvh)", overflowY: "auto",
            textAlign: "center",
            animation: "overlayScaleIn 0.3s ease-out",
          }}>
            <h2 style={{ fontSize: "clamp(16px, 5dvh, 24px)", marginBottom: "clamp(4px, 1.2dvh, 8px)" }}>
              {go.winnerId !== null
                ? `🎉 ${(go.playerNames ?? [])[go.winnerId] || "玩家"} 胡了!`
                : "流局 / Draw"}
            </h2>
            <p style={{ fontSize: "clamp(12px, 3.5dvh, 16px)", color: "var(--color-text-gold)", marginBottom: "clamp(6px, 2dvh, 12px)" }}>
              {game.winTypeNames[go.winType] || go.winType}
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
                <div style={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center", marginBottom: "clamp(6px, 2dvh, 12px)" }}>
                  {winnerHand.melds.map((m, mi) => (
                    <div key={`m${mi}`} style={{ display: "flex", gap: 1 }}>
                      {m.tiles.map((t) => (
                        <TileView key={t.id} tile={t} faceUp={m.type !== MeldType.AnGang} small gold={game.gameState?.gold} style={tileStyle} />
                      ))}
                    </div>
                  ))}
                  {winnerHand.hand.map(t => (
                    <TileView key={t.id} tile={t} faceUp small gold={game.gameState?.gold} style={tileStyle} />
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
                <div style={{ fontSize: "clamp(10px, 2.8dvh, 12px)", color: "var(--color-text-secondary)", marginBottom: "clamp(2px, 0.8dvh, 4px)" }}>得分明细</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(2px, 0.8dvh, 4px) clamp(6px, 2dvh, 12px)", justifyContent: "center", fontSize: "clamp(11px, 3dvh, 13px)", color: "var(--color-text-primary)" }}>
                  <span>花分: {go.breakdown.flowerScore}</span>
                  <span>金: {go.breakdown.goldScore}</span>
                  <span>连庄: {go.breakdown.lianZhuangCount}</span>
                  <span>特殊: {go.breakdown.specialMultiplier}x</span>
                </div>
                <div style={{ fontSize: "clamp(12px, 3.2dvh, 14px)", color: "var(--color-text-gold)", marginTop: "clamp(2px, 0.8dvh, 4px)" }}>
                  总分: {go.breakdown.totalScore}
                </div>
              </div>
            )}

            {/* Round scores */}
            <div style={{ marginBottom: "clamp(6px, 2dvh, 12px)" }}>
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

            {/* Actions */}
            <div style={{ display: "flex", gap: "clamp(6px, 2dvh, 12px)", justifyContent: "center", flexWrap: "wrap" }}>
              <Button variant="gold" size="lg" onClick={game.handleNextRound} style={{ minHeight: "clamp(var(--btn-min-size), 10dvh, 48px)" }}>
                下一局 / Next Round
              </Button>
              {game.onLeave && (
                <Button variant="secondary" onClick={game.handleLeaveOrShowSummary} style={{ minHeight: "clamp(var(--btn-min-size), 10dvh, 48px)" }}>
                  离开 / Leave
                </Button>
              )}
            </div>
          </div>
          {game.sessionSummary && (
            <SessionSummary
              data={game.sessionSummary}
              onClose={game.handleSessionSummaryClose}
            />
          )}
        </div>
        );
      })()}
    </div>
  );
}
