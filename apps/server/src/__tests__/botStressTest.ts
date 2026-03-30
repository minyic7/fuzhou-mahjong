/**
 * Bot Stress Test — runs many bot-only games and verifies none stall.
 *
 * Usage:  npx tsx apps/server/src/__tests__/botStressTest.ts [numGames]
 *
 * Each game creates 4 bots, triggers the dealer action, and waits for the game
 * to reach Finished or Draw phase within a timeout.  Any game that doesn't
 * finish is reported as a stall.
 */

import { GamePhase } from "@fuzhou-mahjong/shared";
import { createGame, getGame, deleteGame } from "../gameState.js";
import { emitOrBotAction } from "../gameEngine.js";

const NUM_GAMES = Number(process.argv[2]) || 50;
const GAME_TIMEOUT_MS = 30_000; // 30s per game

/** Minimal mock of Socket.IO Server — bots never need real sockets. */
function createMockIO(): any {
  const noopSocket = {
    emit: () => {},
    join: () => {},
    leave: () => {},
  };
  return {
    sockets: {
      sockets: new Map<string, typeof noopSocket>(),
    },
    to: () => ({ emit: () => {} }),
    emit: () => {},
  };
}

interface GameResult {
  index: number;
  roomId: string;
  phase: string;
  durationMs: number;
  stalled: boolean;
}

async function runOneGame(index: number): Promise<GameResult> {
  const roomId = `stress-test-${index}`;
  const socketIds = ["bot-0", "bot-1", "bot-2", "bot-3"];
  const playerNames = ["Bot0", "Bot1", "Bot2", "Bot3"];
  const botIndices = [0, 1, 2, 3];

  const io = createMockIO();
  const game = createGame(roomId, socketIds, playerNames, botIndices);
  const start = Date.now();

  // Trigger the dealer's first action (same as triggerDealerAction)
  const dealerIdx = game.state.dealerIndex;
  const actions = game.getInitialDealerActions();
  emitOrBotAction(io, game, dealerIdx, actions);

  // Poll for game completion
  return new Promise<GameResult>((resolve) => {
    const interval = setInterval(() => {
      const current = getGame(roomId);
      if (!current) {
        clearInterval(interval);
        resolve({ index, roomId, phase: "deleted", durationMs: Date.now() - start, stalled: true });
        return;
      }
      if (current.state.phase === GamePhase.Finished || current.state.phase === GamePhase.Draw) {
        clearInterval(interval);
        deleteGame(roomId);
        resolve({ index, roomId, phase: current.state.phase, durationMs: Date.now() - start, stalled: false });
      }
    }, 100);

    // Timeout failsafe
    setTimeout(() => {
      clearInterval(interval);
      const current = getGame(roomId);
      const phase = current?.state.phase ?? "deleted";
      if (current) deleteGame(roomId);
      resolve({ index, roomId, phase, durationMs: Date.now() - start, stalled: phase !== GamePhase.Finished && phase !== GamePhase.Draw });
    }, GAME_TIMEOUT_MS);
  });
}

async function main() {
  console.log(`\n=== Bot Stress Test: ${NUM_GAMES} games ===\n`);

  const results: GameResult[] = [];
  // Run games sequentially to avoid timer interference
  for (let i = 0; i < NUM_GAMES; i++) {
    const result = await runOneGame(i);
    const status = result.stalled ? "STALL" : "OK";
    console.log(`Game ${String(i + 1).padStart(3)}: ${status}  phase=${result.phase}  ${result.durationMs}ms`);
    results.push(result);
  }

  const stalls = results.filter((r) => r.stalled);
  const finished = results.filter((r) => r.phase === GamePhase.Finished);
  const draws = results.filter((r) => r.phase === GamePhase.Draw);

  console.log(`\n=== Results ===`);
  console.log(`Total:    ${results.length}`);
  console.log(`Finished: ${finished.length}`);
  console.log(`Draws:    ${draws.length}`);
  console.log(`Stalls:   ${stalls.length}`);

  if (stalls.length > 0) {
    console.error(`\nFAILED — ${stalls.length} game(s) stalled:`);
    for (const s of stalls) {
      console.error(`  Game ${s.index}: phase=${s.phase}, duration=${s.durationMs}ms`);
    }
    process.exit(1);
  } else {
    console.log(`\nPASSED — all ${results.length} games completed successfully.`);
    process.exit(0);
  }
}

main();
