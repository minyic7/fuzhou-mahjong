import type { Server } from "socket.io";
import {
  ActionType,
  GamePhase,
  MeldType,
  isGoldTile,
  findChiCombinations,
  canPeng,
  canMingGang,
  findAnGang,
  findBuGang,
  checkWin,
  isDraw,
  isInFinalDraws,
  calculateRetainCount,
  isSuitedTile,
  calculateScore,
  getNextDealer,
  WinType,
  decideBotAction,
  sortHand,
} from "@fuzhou-mahjong/shared";
import type {
  GameAction,
  TileInstance,
  ClientEvents,
  ServerEvents,
  Meld,
  WinContext,
  BotContext,
} from "@fuzhou-mahjong/shared";
import { ServerGameState, getGame, setOnGameDeleted } from "./gameState.js";
import { findRoom, findRoomBySocket } from "./room.js";

type GameServer = Server<ClientEvents, ServerEvents>;

const ACTION_TIMEOUT_MS = 30_000;

// ─── Action Window ───────────────────────────────────────────────

interface PendingAction {
  playerIndex: number;
  action: GameAction;
  priority: number; // higher = higher priority
}

function actionPriority(action: GameAction): number {
  switch (action.type) {
    case ActionType.Hu: return 100;
    case ActionType.Peng: return 50;
    case ActionType.MingGang: return 50;
    case ActionType.Chi: return 10;
    case ActionType.Pass: return 0;
    default: return 0;
  }
}

class ActionWindow {
  private responses = new Map<number, GameAction>();
  private pendingPlayers: Set<number>;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onResolve: (winner: PendingAction | null) => void;
  private discarderIndex: number;
  private resolved = false;

  constructor(
    pendingPlayers: number[],
    discarderIndex: number,
    onResolve: (winner: PendingAction | null) => void,
  ) {
    this.pendingPlayers = new Set(pendingPlayers);
    this.discarderIndex = discarderIndex;
    this.onResolve = onResolve;

    this.timer = setTimeout(() => {
      // Auto-pass for all remaining
      for (const pi of this.pendingPlayers) {
        this.responses.set(pi, { type: ActionType.Pass, playerIndex: pi });
      }
      this.pendingPlayers.clear();
      this.tryResolve();
    }, ACTION_TIMEOUT_MS);
  }

  addResponse(playerIndex: number, action: GameAction): boolean {
    if (this.resolved) return false;
    if (!this.pendingPlayers.has(playerIndex)) return false;
    this.responses.set(playerIndex, action);
    this.pendingPlayers.delete(playerIndex);
    this.tryResolve();
    return true;
  }

  private tryResolve(): void {
    if (this.pendingPlayers.size > 0) return;
    this.resolved = true;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }

    // Find highest priority action
    let best: PendingAction | null = null;
    for (const [playerIndex, action] of this.responses) {
      const priority = actionPriority(action);
      if (priority === 0) continue; // pass
      if (!best || priority > best.priority ||
          (priority === best.priority && this.isCloserToDiscarder(playerIndex, best.playerIndex))) {
        best = { playerIndex, action, priority };
      }
    }

    this.onResolve(best);
  }

  private isCloserToDiscarder(a: number, b: number): boolean {
    const distA = ((a - this.discarderIndex + 4) % 4);
    const distB = ((b - this.discarderIndex + 4) % 4);
    return distA < distB;
  }

  isPending(playerIndex: number): boolean {
    return this.pendingPlayers.has(playerIndex);
  }

  cancel(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }
}

// ─── Game Engine ─────────────────────────────────────────────────

const activeWindows = new Map<string, ActionWindow>();

/** Exported for diagnostics (e.g. stress tests). */
export function hasActiveWindow(roomId: string): boolean {
  return activeWindows.has(roomId);
}

// ─── Gang Safety Timeouts ────────────────────────────────────────
const gangSafetyTimeouts = new Map<string, NodeJS.Timeout[]>();

function addGangSafetyTimeout(roomId: string, timer: NodeJS.Timeout): void {
  let timers = gangSafetyTimeouts.get(roomId);
  if (!timers) { timers = []; gangSafetyTimeouts.set(roomId, timers); }
  timers.push(timer);
}

// ─── Bot Watchdog Timer ──────────────────────────────────────────
const BOT_WATCHDOG_MS = 10_000;
const botWatchdogs = new Map<string, NodeJS.Timeout>();

function startBotWatchdog(roomId: string, playerIndex: number, io: GameServer): void {
  const key = roomId + ":" + playerIndex;
  clearBotWatchdog(roomId, playerIndex);

  const watchdogVersion = getBotVersion(roomId, playerIndex);
  const watchdog = setTimeout(() => {
    botWatchdogs.delete(key);
    if (getBotVersion(roomId, playerIndex) !== watchdogVersion) {
      console.log(`[Bot:${roomId}:p${playerIndex}:watchdog] Fired but bot version changed (had=${watchdogVersion}, now=${getBotVersion(roomId, playerIndex)}) — skipping ts=${Date.now()}`);
      return;
    }
    const game = getGame(roomId);
    if (!game || game.state.phase !== GamePhase.Playing) {
      console.log(`[Bot:${roomId}:p${playerIndex}:watchdog] Fired but game ended (phase=${game?.state.phase ?? "deleted"}) ts=${Date.now()}`);
      return;
    }
    // Check if this bot is in an action window context
    const window = activeWindows.get(roomId);
    if (window) {
      if (!window.isPending(playerIndex)) {
        console.log(`[Bot:${roomId}:p${playerIndex}:watchdog] Fired but bot already responded to action window ts=${Date.now()}`);
        return;
      }
      console.warn(`[Bot:${roomId}:p${playerIndex}:watchdog] Firing for action window bot — forcing Pass ts=${Date.now()}`);
      try {
        handlePlayerAction(io, roomId, { type: ActionType.Pass, playerIndex }, playerIndex);
      } catch (e) {
        console.error(`[Bot:${roomId}:p${playerIndex}:watchdog] Action window Pass failed:`, e);
      }
      return;
    }

    // Turn-based context: check if this specific bot is the current turn
    if (playerIndex !== game.state.currentTurn) {
      console.log(`[Bot:${roomId}:p${playerIndex}:watchdog] Fired but playerIndex≠currentTurn (currentTurn=${game.state.currentTurn}) ts=${Date.now()}`);
      return;
    }
    if (!game.isBot(game.state.currentTurn)) {
      console.log(`[Bot:${roomId}:p${playerIndex}:watchdog] Fired but currentTurn=${game.state.currentTurn} is not a bot ts=${Date.now()}`);
      return;
    }

    const player = game.state.players[playerIndex];
    console.warn(
      `[Bot:${roomId}:p${playerIndex}:t${game.state.currentTurn}:watchdog] Exceeded ${BOT_WATCHDOG_MS}ms — forcing default action. ` +
      `phase=${game.state.phase}, handSize=${player.hand.length}, ` +
      `wallRemaining=${game.state.wall.length + game.state.wallTail.length}, ` +
      `currentTurn=${game.state.currentTurn}, pendingWindow=${activeWindows.has(roomId)}, ts=${Date.now()}`,
    );

    try {
      const fallback = emergencyDiscard(player.hand, playerIndex, game.state.gold);
      console.log(`[Bot:${roomId}:p${playerIndex}:watchdog] Emergency discard ts=${Date.now()}`);
      handlePlayerAction(io, roomId, fallback, playerIndex);
    } catch (e) {
      console.error(`[Bot:${roomId}:p${playerIndex}:watchdog] Fallback failed:`, e);
      try {
        advanceToNextPlayer(io, game, playerIndex);
      } catch (e2) {
        console.error(`[Bot:${roomId}:p${playerIndex}:watchdog] advanceToNextPlayer also failed:`, e2);
      }
    }
  }, BOT_WATCHDOG_MS);

  botWatchdogs.set(key, watchdog);
}

function clearBotWatchdog(roomId: string, playerIndex: number): void {
  const key = roomId + ":" + playerIndex;
  const existing = botWatchdogs.get(key);
  if (existing) {
    clearTimeout(existing);
    botWatchdogs.delete(key);
  }
}

/** Monotonic counter per room+player to invalidate stale bot callbacks. */
const botActionVersion = new Map<string, number[]>();

function nextBotVersion(roomId: string, playerIndex: number): number {
  let versions = botActionVersion.get(roomId);
  if (!versions) { versions = [0, 0, 0, 0]; botActionVersion.set(roomId, versions); }
  versions[playerIndex] = (versions[playerIndex] ?? 0) + 1;
  return versions[playerIndex];
}

function getBotVersion(roomId: string, playerIndex: number): number {
  const versions = botActionVersion.get(roomId);
  return versions?.[playerIndex] ?? 0;
}

// Clean up per-room state when a game is deleted
setOnGameDeleted((roomId) => {
  botActionVersion.delete(roomId);
  for (let i = 0; i < 4; i++) clearBotWatchdog(roomId, i);
  const window = activeWindows.get(roomId);
  if (window) {
    window.cancel();
    activeWindows.delete(roomId);
  }
  // Clear gang safety timeouts
  const gangTimers = gangSafetyTimeouts.get(roomId);
  if (gangTimers) {
    for (const t of gangTimers) clearTimeout(t);
    gangSafetyTimeouts.delete(roomId);
  }
});

/** Pick first non-gold tile to discard as emergency fallback. Returns Pass if hand is empty. */
function emergencyDiscard(
  hand: TileInstance[],
  playerIndex: number,
  gold: import("@fuzhou-mahjong/shared").GoldState | null,
): GameAction {
  if (hand.length === 0) {
    console.warn(`[GameEngine] emergencyDiscard: player ${playerIndex} has empty hand, passing`);
    return { type: ActionType.Pass, playerIndex };
  }
  const tile = hand.find(t => !gold || !isGoldTile(t, gold)) ?? hand[0];
  return { type: ActionType.Discard, playerIndex, tile };
}

export function handlePlayerAction(
  io: GameServer,
  socketIdOrRoomId: string,
  action: GameAction,
  botPlayerIndex?: number,
): boolean {
  let room: ReturnType<typeof findRoomBySocket>;
  let game: ReturnType<typeof getGame>;
  let playerIndex: number;

  if (botPlayerIndex !== undefined) {
    // Bot action: resolve by room ID directly
    game = getGame(socketIdOrRoomId);
    if (!game) {
      console.error(`[GameEngine] handlePlayerAction rejected: game not found for roomId=${socketIdOrRoomId}, playerIndex=${botPlayerIndex}, actionType=${action.type}`);
      return false;
    }
    if (game.state.phase !== GamePhase.Playing) {
      console.warn(`[GameEngine] handlePlayerAction rejected: phase=${game.state.phase}, playerIndex=${botPlayerIndex}, actionType=${action.type}`);
      return false;
    }
    playerIndex = botPlayerIndex;
    room = findRoom(game.roomId);
    if (!room) {
      console.error(`[GameEngine] handlePlayerAction rejected: room not found for roomId=${game.roomId}, playerIndex=${botPlayerIndex}, actionType=${action.type}`);
      return false;
    }
    // Bots don't need error feedback
  } else {
    // Human action: resolve by socket ID
    room = findRoomBySocket(socketIdOrRoomId);
    if (!room) return false;
    game = getGame(room.id);
    if (!game || game.state.phase !== GamePhase.Playing) {
      const socket = io.sockets.sockets.get(socketIdOrRoomId);
      socket?.emit('actionError', { message: 'Invalid game phase', code: 'WRONG_PHASE' });
      return false;
    }
    playerIndex = game.getPlayerIndex(socketIdOrRoomId);
    if (playerIndex === -1) return false;
  }

  // Clear watchdog on any successful action processing for this player
  clearBotWatchdog(room.id, playerIndex);

  // Check if there's an active action window
  const window = activeWindows.get(room.id);
  if (window) {
    const accepted = window.addResponse(playerIndex, action);
    if (!accepted) {
      console.warn(`[GameEngine] addResponse rejected for player ${playerIndex} — window may be stale`);
      return false;
    }
    return true;
  }

  // Direct actions (during player's own turn)
  const state = game.state;
  if (state.currentTurn !== playerIndex) {
    if (botPlayerIndex !== undefined) {
      console.warn(`Bot ${playerIndex} action rejected: not their turn (current: ${state.currentTurn}). Watchdog active — will handle if stuck.`);
    } else {
      const socket = io.sockets.sockets.get(socketIdOrRoomId);
      socket?.emit('actionError', { message: 'Not your turn', code: 'WRONG_TURN' });
    }
    return false;
  }

  switch (action.type) {
    case ActionType.Discard:
      handleDiscard(io, game, playerIndex, action.tile);
      break;
    case ActionType.AnGang:
      handleAnGang(io, game, playerIndex, action.tile);
      break;
    case ActionType.BuGang:
      handleBuGang(io, game, playerIndex, action.tile);
      break;
    case ActionType.Hu:
      handleSelfDrawHu(io, game, playerIndex);
      break;
    case ActionType.Draw:
      handleDraw(io, game, playerIndex);
      break;
    case ActionType.Pass:
      // Pass during own turn: advance to next player's draw
      advanceToNextPlayer(io, game, playerIndex);
      break;
    default:
      console.warn(`[GameEngine] Unhandled action type in handlePlayerAction: ${action.type}${botPlayerIndex !== undefined ? '. Watchdog active — will handle if stuck.' : ''}`);
      return false;
  }
  return true;
}

function handleDiscard(
  io: GameServer,
  game: ServerGameState,
  playerIndex: number,
  tile: TileInstance,
  depth = 0,
): void {
  const state = game.state;
  const player = state.players[playerIndex];

  // Remove tile from hand
  const tileIdx = player.hand.findIndex((t) => t.id === tile.id);
  if (tileIdx === -1) {
    if (game.isBot(playerIndex)) {
      console.warn(`[GameEngine] Bot ${playerIndex} discard failed: tile ${tile.id} not in hand — forcing emergency discard`);
      if (depth > 1) {
        console.error(`[GameEngine] Bot ${playerIndex} emergency discard recursion limit reached (depth=${depth}) — advancing turn`);
        advanceToNextPlayer(io, game, playerIndex);
        return;
      }
      const fallback = emergencyDiscard(player.hand, playerIndex, state.gold);
      if (fallback.type === ActionType.Discard) {
        handleDiscard(io, game, playerIndex, fallback.tile!, depth + 1);
      } else {
        advanceToNextPlayer(io, game, playerIndex);
      }
      return;
    }
    const socketId = game.getSocketId(playerIndex);
    const socket = io.sockets.sockets.get(socketId);
    socket?.emit('actionError', { message: 'Tile not found in hand', code: 'TILE_NOT_FOUND' });
    return;
  }
  player.hand.splice(tileIdx, 1);
  player.discards.push(tile);
  state.lastDiscard = { tile, playerIndex };
  game.firstActionTaken = true;
  game.lastDrawnTileIds[playerIndex] = null;

  // Gold discard penalty
  if (state.gold && isGoldTile(tile, state.gold)) {
    player.hasDiscardedGold = true;
  }

  // Broadcast state before action prompts so clients have updated lastDiscard
  broadcastState(io, game);

  // Check if anyone can act on this discard
  const pendingPlayers: number[] = [];

  for (let i = 0; i < 4; i++) {
    if (i === playerIndex) continue;

    const actions = getResponseActions(game, i, tile, playerIndex);
    if (actions.canHu || actions.canPeng || actions.canMingGang || actions.chiOptions.length > 0) {
      pendingPlayers.push(i);
      emitOrBotAction(io, game, i, actions, tile);
    }
  }

  if (pendingPlayers.length === 0) {
    // No one can act, next player draws
    advanceToNextPlayer(io, game, playerIndex);
  } else {
    // Open action window
    const existingWindow = activeWindows.get(game.roomId);
    if (existingWindow) {
      console.warn(`[GameEngine] Overwriting existing action window for room ${game.roomId} (discard)`);
      existingWindow.cancel();
    }
    const window = new ActionWindow(pendingPlayers, playerIndex, (winner) => {
      resolveActionWindow(io, game, winner, playerIndex, tile);
      activeWindows.delete(game.roomId);
    });
    activeWindows.set(game.roomId, window);
  }
}

function handleDraw(
  io: GameServer,
  game: ServerGameState,
  playerIndex: number,
): void {
  const state = game.state;

  // Check draw condition
  state.retainCount = calculateRetainCount(state.players);
  if (isDraw(state.wall.length, state.wallTail.length, state.retainCount)) {
    endGameDraw(io, game);
    return;
  }

  // Draw from wall
  if (state.wall.length === 0) {
    endGameDraw(io, game);
    return;
  }

  let tile = state.wall.shift()!;
  const player = state.players[playerIndex];

  // If flower, keep drawing replacements from tail until a suited tile is found
  while (!isSuitedTile(tile.tile)) {
    player.flowers.push(tile);
    if (state.wallTail.length === 0) {
      endGameDraw(io, game);
      return;
    }
    tile = state.wallTail.pop()!;
  }
  player.hand.push(tile);
  player.hand = sortHand(player.hand, state.gold);
  game.lastDrawnTileIds[playerIndex] = tile.id;

  state.lastDiscard = null;

  broadcastState(io, game);

  // Check for available actions after draw
  const inFinalDraws = isInFinalDraws(state.wall.length, state.wallTail.length, state.retainCount);

  const actions = getPostDrawActions(game, playerIndex, inFinalDraws);

  // During final draws, if player can't hu, auto-pass immediately instead of waiting for input
  if (inFinalDraws && !actions.canHu) {
    handlePlayerAction(io, game.roomId, { type: ActionType.Pass, playerIndex }, playerIndex);
    return;
  }

  emitOrBotAction(io, game, playerIndex, actions);
}

function handleAnGang(
  io: GameServer,
  game: ServerGameState,
  playerIndex: number,
  tile: TileInstance,
): void {
  const state = game.state;
  const player = state.players[playerIndex];

  // Find all 4 matching tiles
  const matching = player.hand.filter(
    (t) => isSuitedTile(t.tile) && isSuitedTile(tile.tile) &&
           t.tile.suit === tile.tile.suit && t.tile.value === tile.tile.value,
  );
  if (matching.length < 4) {
    if (game.isBot(playerIndex)) {
      console.warn(`[GameEngine] Bot ${playerIndex} AnGang failed: only ${matching.length} matching tiles — forcing emergency discard`);
      const fallback = emergencyDiscard(player.hand, playerIndex, state.gold);
      handlePlayerAction(io, game.roomId, fallback, playerIndex);
    }
    return;
  }

  // Remove from hand
  const anGangIds = matching.map(m => m.id);
  if (new Set(anGangIds).size !== anGangIds.length) {
    console.warn(`[GameEngine] Duplicate tile IDs in matching: ${anGangIds}`);
  }
  for (const m of matching) {
    const idx = player.hand.findIndex((t) => t.id === m.id);
    if (idx < 0) {
      console.warn(`[GameEngine] Tile ${m.id} not found in hand during AnGang`);
      continue;
    }
    player.hand.splice(idx, 1);
  }

  // Create meld
  const meld: Meld = { type: MeldType.AnGang, tiles: matching };
  player.melds.push(meld);

  // Update retain count
  state.retainCount = calculateRetainCount(state.players);

  // Draw replacement from tail
  gangDraw(io, game, playerIndex);
  // Safety timeout: if gangDraw leaves game stuck, force advance
  const anGangBotVersion = getBotVersion(game.roomId, playerIndex);
  const anGangSafetyTimer = setTimeout(() => {
    // Self-cleanup
    const timers = gangSafetyTimeouts.get(game.roomId);
    if (timers) {
      gangSafetyTimeouts.set(game.roomId, timers.filter(t => t !== anGangSafetyTimer));
    }
    // Skip if bot version changed — emitOrBotAction already handled this bot
    if (getBotVersion(game.roomId, playerIndex) !== anGangBotVersion) {
      console.log(`[GameEngine] AnGang safety timeout skipped — bot version changed (had=${anGangBotVersion}, now=${getBotVersion(game.roomId, playerIndex)})`);
      return;
    }
    if (game.state.currentTurn === playerIndex && game.state.phase === GamePhase.Playing) {
      const player = game.state.players[playerIndex];
      console.warn(`[GameEngine] gangDraw safety timeout fired for AnGang (roomId=${game.roomId}, playerIndex=${playerIndex}, turn=${game.state.currentTurn}, phase=${game.state.phase})`);
      try {
        handlePlayerAction(io, game.roomId, emergencyDiscard(player.hand, playerIndex, game.state.gold), playerIndex);
      } catch (err) {
        console.error(`[GameEngine] gangDraw safety timeout fallback failed:`, err);
        advanceToNextPlayer(io, game, playerIndex);
      }
    }
  }, 3000);
  addGangSafetyTimeout(game.roomId, anGangSafetyTimer);
}

function handleBuGang(
  io: GameServer,
  game: ServerGameState,
  playerIndex: number,
  tile: TileInstance,
): void {
  const state = game.state;
  const player = state.players[playerIndex];

  // Find the peng meld to upgrade
  const meldIdx = player.melds.findIndex(
    (m) => m.type === MeldType.Peng && m.tiles[0] &&
           isSuitedTile(m.tiles[0].tile) && isSuitedTile(tile.tile) &&
           m.tiles[0].tile.suit === tile.tile.suit && m.tiles[0].tile.value === tile.tile.value,
  );
  if (meldIdx === -1) {
    if (game.isBot(playerIndex)) {
      console.warn(`[GameEngine] Bot ${playerIndex} BuGang failed: no matching Peng meld — forcing emergency discard`);
      const fallback = emergencyDiscard(player.hand, playerIndex, state.gold);
      handlePlayerAction(io, game.roomId, fallback, playerIndex);
    }
    return;
  }

  // Check for robbing kong (抢杠胡)
  // Other players can hu on this tile
  const canRob: number[] = [];
  for (let i = 0; i < 4; i++) {
    if (i === playerIndex) continue;
    const winResult = checkWin(state.players[i], tile, state.gold, {
      isSelfDraw: false,
      isFirstAction: !game.firstActionTaken,
      isDealer: state.players[i].isDealer,
      isRobbingKong: true,
      totalFlowers: state.players[i].flowers.length,
      totalGangs: state.players[i].melds.filter(
        (m) => m.type === MeldType.MingGang || m.type === MeldType.AnGang || m.type === MeldType.BuGang,
      ).length,
    });
    if (winResult.isWin) canRob.push(i);
  }

  if (canRob.length > 0) {
    // Ask robbers if they want to hu
    for (const i of canRob) {
      const actions: import("@fuzhou-mahjong/shared").AvailableActions = {
        canDraw: false, canDiscard: false, chiOptions: [], canPeng: false,
        canMingGang: false, anGangOptions: [], buGangOptions: [], canHu: true, canPass: true,
      };
      emitOrBotAction(io, game, i, actions, tile);
    }

    const existingWindow = activeWindows.get(game.roomId);
    if (existingWindow) {
      console.warn(`[GameEngine] Overwriting existing action window for room ${game.roomId} (BuGang rob check)`);
      existingWindow.cancel();
    }
    const window = new ActionWindow(canRob, playerIndex, (winner) => {
      if (winner && winner.action.type === ActionType.Hu) {
        endGameWin(io, game, winner.playerIndex, tile, false, true);
      } else {
        // No one robbed, proceed with bu gang
        executeBuGang(io, game, playerIndex, tile, meldIdx);
      }
      activeWindows.delete(game.roomId);
    });
    activeWindows.set(game.roomId, window);
  } else {
    executeBuGang(io, game, playerIndex, tile, meldIdx);
  }
}

function executeBuGang(
  io: GameServer,
  game: ServerGameState,
  playerIndex: number,
  tile: TileInstance,
  meldIdx: number,
): void {
  const player = game.state.players[playerIndex];

  // Remove tile from hand
  const handIdx = player.hand.findIndex((t) => t.id === tile.id);
  if (handIdx < 0) {
    console.warn(`[GameEngine] Tile ${tile.id} not found in hand during BuGang`);
  } else {
    player.hand.splice(handIdx, 1);
  }

  // Upgrade peng to bu gang
  player.melds[meldIdx].type = MeldType.BuGang;
  player.melds[meldIdx].tiles.push(tile);

  game.state.retainCount = calculateRetainCount(game.state.players);

  gangDraw(io, game, playerIndex);
  // Safety timeout: if gangDraw leaves game stuck, force advance
  const buGangBotVersion = getBotVersion(game.roomId, playerIndex);
  const buGangSafetyTimer = setTimeout(() => {
    // Self-cleanup
    const timers = gangSafetyTimeouts.get(game.roomId);
    if (timers) {
      gangSafetyTimeouts.set(game.roomId, timers.filter(t => t !== buGangSafetyTimer));
    }
    // Skip if bot version changed — emitOrBotAction already handled this bot
    if (getBotVersion(game.roomId, playerIndex) !== buGangBotVersion) {
      console.log(`[GameEngine] BuGang safety timeout skipped — bot version changed (had=${buGangBotVersion}, now=${getBotVersion(game.roomId, playerIndex)})`);
      return;
    }
    if (game.state.currentTurn === playerIndex && game.state.phase === GamePhase.Playing) {
      const player = game.state.players[playerIndex];
      console.warn(`[GameEngine] gangDraw safety timeout fired for BuGang (roomId=${game.roomId}, playerIndex=${playerIndex}, turn=${game.state.currentTurn}, phase=${game.state.phase})`);
      try {
        handlePlayerAction(io, game.roomId, emergencyDiscard(player.hand, playerIndex, game.state.gold), playerIndex);
      } catch (err) {
        console.error(`[GameEngine] gangDraw safety timeout fallback failed:`, err);
        advanceToNextPlayer(io, game, playerIndex);
      }
    }
  }, 3000);
  addGangSafetyTimeout(game.roomId, buGangSafetyTimer);
}

function handleSelfDrawHu(
  io: GameServer,
  game: ServerGameState,
  playerIndex: number,
): void {
  const player = game.state.players[playerIndex];
  if (player.hand.length === 0) {
    if (game.isBot(playerIndex)) {
      console.warn(`[GameEngine] Bot ${playerIndex} Hu failed: empty hand — forcing pass`);
      handlePlayerAction(io, game.roomId, { type: ActionType.Pass, playerIndex }, playerIndex);
    }
    return;
  }

  // Find the drawn tile by tracked ID (hand is sorted, so it may not be last)
  const drawnId = game.lastDrawnTileIds[playerIndex];
  const winningTile = drawnId != null
    ? player.hand.find((t) => t.id === drawnId) ?? player.hand[player.hand.length - 1]
    : player.hand[player.hand.length - 1];

  const winResult = checkWin(player, winningTile, game.state.gold, {
    isSelfDraw: true,
    isFirstAction: !game.firstActionTaken,
    isDealer: player.isDealer,
    isRobbingKong: false,
    totalFlowers: player.flowers.length,
    totalGangs: player.melds.filter(
      (m) => m.type === MeldType.MingGang || m.type === MeldType.AnGang || m.type === MeldType.BuGang,
    ).length,
  });

  if (winResult.isWin) {
    endGameWin(io, game, playerIndex, winningTile, true);
  } else if (game.isBot(playerIndex)) {
    console.warn(`[GameEngine] Bot ${playerIndex} Hu failed: win check returned false — forcing emergency discard`);
    const fallback = emergencyDiscard(player.hand, playerIndex, game.state.gold);
    handlePlayerAction(io, game.roomId, fallback, playerIndex);
  }
}

function gangDraw(
  io: GameServer,
  game: ServerGameState,
  playerIndex: number,
): void {
  const state = game.state;
  const player = state.players[playerIndex];

  // Iterative loop to handle consecutive flowers from wallTail
  const maxFlowers = 8; // max flower tiles in the game
  let iterations = 0;
  while (true) {
    if (state.wallTail.length === 0 || iterations >= maxFlowers) {
      endGameDraw(io, game);
      return;
    }
    iterations++;

    const tile = state.wallTail.pop()!;

    if (!isSuitedTile(tile.tile)) {
      player.flowers.push(tile);
      continue; // draw another replacement
    }

    player.hand.push(tile);
    player.hand = sortHand(player.hand, state.gold);
    game.lastDrawnTileIds[playerIndex] = tile.id;
    broadcastState(io, game);

    // After gang draw, player gets actions (discard, check hu/gang)
    const actions = getPostDrawActions(game, playerIndex, false);
    emitOrBotAction(io, game, playerIndex, actions);
    return;
  }
}

// ─── Action Resolution ──────────────────────────────────────────

function resolveActionWindow(
  io: GameServer,
  game: ServerGameState,
  winner: PendingAction | null,
  discarderIndex: number,
  discardTile: TileInstance,
): void {
  if (game.state.phase !== GamePhase.Playing) {
    console.warn(`[GameEngine] resolveActionWindow skipped: phase is ${game.state.phase}`);
    return;
  }

  if (!winner) {
    // All passed, next player draws
    advanceToNextPlayer(io, game, discarderIndex);
    return;
  }

  const state = game.state;

  switch (winner.action.type) {
    case ActionType.Hu:
      try {
        endGameWin(io, game, winner.playerIndex, discardTile, false);
      } catch (e) {
        console.error(`[GameEngine] resolveActionWindow Hu failed:`, e);
        advanceToNextPlayer(io, game, winner.playerIndex);
      }
      break;

    case ActionType.Peng: {
      try {
        const player = state.players[winner.playerIndex];
        // Remove 2 matching tiles from hand
        const matching = player.hand.filter(
          (t) => isSuitedTile(t.tile) && isSuitedTile(discardTile.tile) &&
                 t.tile.suit === discardTile.tile.suit && t.tile.value === discardTile.tile.value,
        );
        const pengIds = matching.map(m => m.id);
        if (new Set(pengIds).size !== pengIds.length) {
          console.warn(`[GameEngine] Duplicate tile IDs in matching: ${pengIds}`);
        }
        for (let i = 0; i < 2 && i < matching.length; i++) {
          const idx = player.hand.findIndex((t) => t.id === matching[i].id);
          if (idx < 0) {
            console.warn(`[GameEngine] Tile ${matching[i].id} not found in hand during Peng`);
            continue;
          }
          player.hand.splice(idx, 1);
        }
        // Remove from discarder's discards
        const discardIdx = state.players[discarderIndex].discards.findIndex((t) => t.id === discardTile.id);
        if (discardIdx >= 0) state.players[discarderIndex].discards.splice(discardIdx, 1);
        // Create meld
        player.melds.push({
          type: MeldType.Peng,
          tiles: [matching[0], matching[1], discardTile],
          sourceTile: discardTile,
          sourcePlayer: discarderIndex,
        });
        state.currentTurn = winner.playerIndex;
        state.lastDiscard = null;
        broadcastState(io, game);
        // Player must discard
        try {
          emitOrBotAction(io, game, winner.playerIndex,
            getPostClaimActions(game, winner.playerIndex));
        } catch (e) {
          console.error(`[GameEngine] post-Peng emitOrBotAction failed:`, e);
          const pPlayer = game.state.players[winner.playerIndex];
          try {
            handlePlayerAction(io, game.roomId, emergencyDiscard(pPlayer.hand, winner.playerIndex, game.state.gold), winner.playerIndex);
          } catch (e2) {
            console.error(`[GameEngine] post-Peng emergency discard failed:`, e2);
            advanceToNextPlayer(io, game, winner.playerIndex);
          }
        }
      } catch (e) {
        console.error(`[GameEngine] resolveActionWindow Peng failed:`, e);
        advanceToNextPlayer(io, game, winner.playerIndex);
      }
      break;
    }

    case ActionType.MingGang: {
      try {
        const player = state.players[winner.playerIndex];
        const matching = player.hand.filter(
          (t) => isSuitedTile(t.tile) && isSuitedTile(discardTile.tile) &&
                 t.tile.suit === discardTile.tile.suit && t.tile.value === discardTile.tile.value,
        );
        const mingGangIds = matching.map(m => m.id);
        if (new Set(mingGangIds).size !== mingGangIds.length) {
          console.warn(`[GameEngine] Duplicate tile IDs in matching: ${mingGangIds}`);
        }
        for (let i = 0; i < 3 && i < matching.length; i++) {
          const idx = player.hand.findIndex((t) => t.id === matching[i].id);
          if (idx < 0) {
            console.warn(`[GameEngine] Tile ${matching[i].id} not found in hand during MingGang`);
            continue;
          }
          player.hand.splice(idx, 1);
        }
        const discardIdx = state.players[discarderIndex].discards.findIndex((t) => t.id === discardTile.id);
        if (discardIdx >= 0) state.players[discarderIndex].discards.splice(discardIdx, 1);
        player.melds.push({
          type: MeldType.MingGang,
          tiles: [...matching.slice(0, 3), discardTile],
          sourceTile: discardTile,
          sourcePlayer: discarderIndex,
        });
        state.currentTurn = winner.playerIndex;
        state.retainCount = calculateRetainCount(state.players);
        const gangPlayerIdx = winner.playerIndex;
        gangDraw(io, game, gangPlayerIdx);
        // Safety timeout: if gangDraw leaves game stuck, force advance
        const mingGangBotVersion = getBotVersion(game.roomId, gangPlayerIdx);
        const mingGangSafetyTimer = setTimeout(() => {
          // Self-cleanup
          const timers = gangSafetyTimeouts.get(game.roomId);
          if (timers) {
            gangSafetyTimeouts.set(game.roomId, timers.filter(t => t !== mingGangSafetyTimer));
          }
          // Skip if bot version changed — emitOrBotAction already handled this bot
          if (getBotVersion(game.roomId, gangPlayerIdx) !== mingGangBotVersion) {
            console.log(`[GameEngine] MingGang safety timeout skipped — bot version changed (had=${mingGangBotVersion}, now=${getBotVersion(game.roomId, gangPlayerIdx)})`);
            return;
          }
          if (game.state.currentTurn === gangPlayerIdx && game.state.phase === GamePhase.Playing) {
            const player = game.state.players[gangPlayerIdx];
            console.warn(`[GameEngine] gangDraw safety timeout fired for MingGang (roomId=${game.roomId}, playerIndex=${gangPlayerIdx}, turn=${game.state.currentTurn}, phase=${game.state.phase})`);
            try {
              handlePlayerAction(io, game.roomId, emergencyDiscard(player.hand, gangPlayerIdx, game.state.gold), gangPlayerIdx);
            } catch (err) {
              console.error(`[GameEngine] gangDraw safety timeout fallback failed:`, err);
              advanceToNextPlayer(io, game, gangPlayerIdx);
            }
          }
        }, 3000);
        addGangSafetyTimeout(game.roomId, mingGangSafetyTimer);
      } catch (e) {
        console.error(`[GameEngine] resolveActionWindow MingGang failed:`, e);
        advanceToNextPlayer(io, game, winner.playerIndex);
      }
      break;
    }

    case ActionType.Chi: {
      try {
        const chiAction = winner.action as import("@fuzhou-mahjong/shared").ChiAction;
        const player = state.players[winner.playerIndex];
        // Remove the 2 chi tiles from hand
        for (const ct of chiAction.tiles) {
          const idx = player.hand.findIndex((t) => t.id === ct.id);
          if (idx >= 0) player.hand.splice(idx, 1);
        }
        const discardIdx = state.players[discarderIndex].discards.findIndex((t) => t.id === discardTile.id);
        if (discardIdx >= 0) state.players[discarderIndex].discards.splice(discardIdx, 1);
        player.melds.push({
          type: MeldType.Chi,
          tiles: [...chiAction.tiles, discardTile],
          sourceTile: discardTile,
          sourcePlayer: discarderIndex,
        });
        state.currentTurn = winner.playerIndex;
        state.lastDiscard = null;
        broadcastState(io, game);
        try {
          emitOrBotAction(io, game, winner.playerIndex,
            getPostClaimActions(game, winner.playerIndex));
        } catch (e) {
          console.error(`[GameEngine] post-Chi emitOrBotAction failed:`, e);
          const cPlayer = game.state.players[winner.playerIndex];
          try {
            handlePlayerAction(io, game.roomId, emergencyDiscard(cPlayer.hand, winner.playerIndex, game.state.gold), winner.playerIndex);
          } catch (e2) {
            console.error(`[GameEngine] post-Chi emergency discard failed:`, e2);
            advanceToNextPlayer(io, game, winner.playerIndex);
          }
        }
      } catch (e) {
        console.error(`[GameEngine] resolveActionWindow Chi failed:`, e);
        advanceToNextPlayer(io, game, winner.playerIndex);
      }
      break;
    }

    default:
      advanceToNextPlayer(io, game, discarderIndex);
      break;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

function advanceToNextPlayer(
  io: GameServer,
  game: ServerGameState,
  currentPlayerIndex: number,
): void {
  if (game.state.phase !== GamePhase.Playing) {
    console.warn(`[GameEngine] advanceToNextPlayer skipped: phase is ${game.state.phase}`);
    return;
  }
  const nextPlayer = (currentPlayerIndex + 1) % 4;
  game.state.currentTurn = nextPlayer;
  handleDraw(io, game, nextPlayer);
}

function getResponseActions(
  game: ServerGameState,
  playerIndex: number,
  discardTile: TileInstance,
  discarderIndex: number,
): import("@fuzhou-mahjong/shared").AvailableActions {
  const state = game.state;
  const player = state.players[playerIndex];
  const gold = state.gold;

  // Check hu (discard win)
  let canHuFlag = false;
  if (!player.hasDiscardedGold) {
    const winResult = checkWin(player, discardTile, gold, {
      isSelfDraw: false,
      isFirstAction: !game.firstActionTaken,
      isDealer: player.isDealer,
      isRobbingKong: false,
      totalFlowers: player.flowers.length,
      totalGangs: player.melds.filter(
        (m) => m.type === MeldType.MingGang || m.type === MeldType.AnGang || m.type === MeldType.BuGang,
      ).length,
    });
    canHuFlag = winResult.isWin;
  }

  // Chi: only the next counterclockwise player can chi
  const isNextPlayer = ((discarderIndex + 1) % 4) === playerIndex;
  const chiOpts = isNextPlayer ? findChiCombinations(player.hand, discardTile, gold) : [];

  const canPengFlag = canPeng(player.hand, discardTile, gold);
  const canMingGangFlag = canMingGang(player.hand, discardTile, gold);

  return {
    canDraw: false,
    canDiscard: false,
    chiOptions: chiOpts,
    canPeng: canPengFlag,
    canMingGang: canMingGangFlag,
    anGangOptions: [],
    buGangOptions: [],
    canHu: canHuFlag,
    canPass: true,
  };
}

function getPostDrawActions(
  game: ServerGameState,
  playerIndex: number,
  inFinalDraws: boolean,
): import("@fuzhou-mahjong/shared").AvailableActions {
  const state = game.state;
  const player = state.players[playerIndex];
  const gold = state.gold;

  // Check self-draw hu (find drawn tile by tracked ID, since hand is sorted)
  const drawnId = game.lastDrawnTileIds[playerIndex];
  const lastTile = drawnId != null
    ? player.hand.find((t) => t.id === drawnId) ?? player.hand[player.hand.length - 1]
    : player.hand[player.hand.length - 1];
  let canHuFlag = false;
  if (lastTile) {
    const winResult = checkWin(player, lastTile, gold, {
      isSelfDraw: true,
      isFirstAction: !game.firstActionTaken,
      isDealer: player.isDealer,
      isRobbingKong: false,
      totalFlowers: player.flowers.length,
      totalGangs: player.melds.filter(
        (m) => m.type === MeldType.MingGang || m.type === MeldType.AnGang || m.type === MeldType.BuGang,
      ).length,
    });
    canHuFlag = winResult.isWin;
  }

  if (inFinalDraws) {
    return {
      canDraw: false,
      canDiscard: false,
      chiOptions: [],
      canPeng: false,
      canMingGang: false,
      anGangOptions: [],
      buGangOptions: [],
      canHu: canHuFlag,
      canPass: true,
    };
  }

  const anGangOpts = findAnGang(player.hand, gold);
  const buGangOpts = findBuGang(player.hand, player.melds, gold);

  return {
    canDraw: false,
    canDiscard: true,
    chiOptions: [],
    canPeng: false,
    canMingGang: false,
    anGangOptions: anGangOpts,
    buGangOptions: buGangOpts,
    canHu: canHuFlag,
    canPass: false,
  };
}

function getPostClaimActions(
  game: ServerGameState,
  playerIndex: number,
): import("@fuzhou-mahjong/shared").AvailableActions {
  return {
    canDraw: false,
    canDiscard: true,
    chiOptions: [],
    canPeng: false,
    canMingGang: false,
    anGangOptions: [],
    buGangOptions: [],
    canHu: false,
    canPass: false,
  };
}

function endGameWin(
  io: GameServer,
  game: ServerGameState,
  winnerIndex: number,
  winningTile: TileInstance,
  isSelfDraw: boolean,
  isRobbingKong = false,
): void {
  const state = game.state;
  state.phase = GamePhase.Finished;

  const staleWindow = activeWindows.get(game.roomId);
  if (staleWindow) {
    console.warn("[ActionWindow] Cleaning up leaked window for room", game.roomId, "(endGameWin)");
    staleWindow.cancel();
    activeWindows.delete(game.roomId);
  }

  const winner = state.players[winnerIndex];
  const winResult = checkWin(winner, winningTile, state.gold, {
    isSelfDraw,
    isFirstAction: !game.firstActionTaken,
    isDealer: winner.isDealer,
    isRobbingKong,
    totalFlowers: winner.flowers.length,
    totalGangs: winner.melds.filter(
      (m) => m.type === MeldType.MingGang || m.type === MeldType.AnGang || m.type === MeldType.BuGang,
    ).length,
  });

  const discarderIndex = isSelfDraw ? null : (state.lastDiscard?.playerIndex ?? null);

  const scoreResult = calculateScore(
    winner,
    winnerIndex,
    winResult.winType,
    winResult.multiplier,
    state.gold,
    isSelfDraw,
    discarderIndex,
    state.lianZhuangCount,
  );

  // Dealer rotation
  const { nextDealer, nextLianZhuang } = getNextDealer(
    state.dealerIndex,
    winnerIndex,
    state.lianZhuangCount,
  );
  state.dealerIndex = nextDealer;
  state.lianZhuangCount = nextLianZhuang;

  broadcastState(io, game);

  // Update cumulative scores in the room
  const room = findRoom(game.roomId);
  let cumulative: { scores: number[]; roundsPlayed: number } | undefined;
  if (room) {
    room.addRoundScores(scoreResult.payments);
    cumulative = room.getCumulativeData();
  }

  io.to(game.roomId).emit("gameOver", {
    winnerId: winnerIndex,
    winType: winResult.winType,
    scores: scoreResult.payments,
    breakdown: {
      flowerScore: scoreResult.flowerScore,
      goldScore: scoreResult.goldScore,
      specialMultiplier: scoreResult.specialMultiplier,
      lianZhuangCount: state.lianZhuangCount,
      totalScore: scoreResult.totalScore,
    },
    playerNames: game.playerNames,
    cumulative,
    allHands: state.players.map((p) => ({
      hand: p.hand,
      melds: p.melds,
      flowers: p.flowers,
    })),
  });
}

function endGameDraw(io: GameServer, game: ServerGameState): void {
  const state = game.state;
  state.phase = GamePhase.Draw;

  const staleWindow = activeWindows.get(game.roomId);
  if (staleWindow) {
    console.warn("[ActionWindow] Cleaning up leaked window for room", game.roomId, "(endGameDraw)");
    staleWindow.cancel();
    activeWindows.delete(game.roomId);
  }

  // Dealer rotation on draw
  const { nextDealer, nextLianZhuang } = getNextDealer(
    state.dealerIndex,
    null,
    state.lianZhuangCount,
  );
  state.dealerIndex = nextDealer;
  state.lianZhuangCount = nextLianZhuang;

  broadcastState(io, game);

  // Update cumulative scores in the room (draw = no score change, but increment round)
  const room = findRoom(game.roomId);
  let cumulative: { scores: number[]; roundsPlayed: number } | undefined;
  if (room) {
    room.addRoundScores([0, 0, 0, 0]);
    cumulative = room.getCumulativeData();
  }

  io.to(game.roomId).emit("gameOver", {
    winnerId: null,
    winType: "draw",
    scores: [0, 0, 0, 0],
    cumulative,
    allHands: state.players.map((p) => ({
      hand: p.hand,
      melds: p.melds,
      flowers: p.flowers,
    })),
  });
}

function broadcastState(io: GameServer, game: ServerGameState): void {
  for (let i = 0; i < 4; i++) {
    if (!game.isBot(i)) {
      const socketId = game.getSocketId(i);
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit("gameStateUpdate", game.getClientGameState(i));
      }
    }
  }
}

/**
 * Emit actionRequired to a player, or auto-respond if bot.
 */
export function emitOrBotAction(
  io: GameServer,
  game: ServerGameState,
  playerIndex: number,
  actions: import("@fuzhou-mahjong/shared").AvailableActions,
  lastDiscardTile?: TileInstance,
  depth = 0,
): void {
  const _tag = `[Bot:${game.roomId}:p${playerIndex}:t${game.state.currentTurn}]`;
  console.log(_tag + ` emitOrBotAction entry (depth=${depth}, hasWindow=${activeWindows.has(game.roomId)}, currentTurn=${game.state.currentTurn})`);

  if (game.isBot(playerIndex)) {
    console.log(_tag + " branch=bot");
    // Guard against infinite recursion from stale re-triggers
    if (depth > 3) {
      const tag = `[Bot:${game.roomId}:p${playerIndex}:t${game.state.currentTurn}]`;
      console.error(`${tag} Recursion depth limit exceeded (depth=${depth})`);
      try {
        const window = activeWindows.get(game.roomId);
        if (window) {
          handlePlayerAction(io, game.roomId, { type: ActionType.Pass, playerIndex }, playerIndex);
        } else {
          const player = game.state.players[playerIndex];
          handlePlayerAction(io, game.roomId, emergencyDiscard(player.hand, playerIndex, game.state.gold), playerIndex);
        }
      } catch (e) {
        console.error(`${tag} Depth-limit rescue failed:`, e);
        try {
          advanceToNextPlayer(io, game, playerIndex);
        } catch (e2) {
          console.error(`${tag} advanceToNextPlayer also failed:`, e2);
        }
      }
      return;
    }
    const version = nextBotVersion(game.roomId, playerIndex);
    const turnNumber = game.state.currentTurn;
    const tag = `[Bot:${game.roomId}:p${playerIndex}:t${turnNumber}]`;
    const delay = 300 + Math.random() * 500;
    startBotWatchdog(game.roomId, playerIndex, io);
    let acted = false;
    // Snapshot the drawn tile ID at schedule time to avoid race conditions
    // where another player's action clears/changes it before the callback fires
    const snapshotDrawnTileId = game.lastDrawnTileIds[playerIndex];

    console.log(`${tag} Scheduling action (version=${version}, delay=${Math.round(delay)}ms, phase=${game.state.phase}) ts=${Date.now()}`);

    let mainTimer: NodeJS.Timeout | null = null;
    const safetyTimer = setTimeout(() => {
      if (acted) {
        // Verify the turn actually advanced — if still on this bot, something went wrong
        if (game.state.currentTurn === playerIndex && game.state.phase === GamePhase.Playing && !activeWindows.has(game.roomId)) {
          console.warn(`${tag} Safety timer: acted=true but turn STILL on this bot (currentTurn=${game.state.currentTurn}, phase=${game.state.phase}) — forcing emergency action ts=${Date.now()}`);
          try {
            const player = game.state.players[playerIndex];
            handlePlayerAction(io, game.roomId, emergencyDiscard(player.hand, playerIndex, game.state.gold), playerIndex);
          } catch (e) {
            console.error(`${tag} Safety timer acted-verify fallback failed:`, e);
          }
          return;
        }
        console.log(`${tag} Safety timer fired but already acted (version=${version}) ts=${Date.now()}`);
        return;
      }
      const currentV = getBotVersion(game.roomId, playerIndex);
      if (currentV !== version) {
        if (mainTimer) clearTimeout(mainTimer);
        console.log(`${tag} Safety timer STALE — bailing (had=${version}, now=${currentV}), cleared mainTimer ts=${Date.now()}`);
        // Re-trigger if game is stuck
        if (game.state.phase === GamePhase.Playing) {
          const window = activeWindows.get(game.roomId);
          if (window) {
            // Action window active: check if this bot has pending actions, otherwise Pass
            if (!window.isPending(playerIndex)) {
              console.log(`${tag} Stale safety re-trigger — bot already responded to action window, skipping ts=${Date.now()}`);
            } else {
              console.warn(`[Bot:FALLBACK] ${tag} Stale safety re-trigger during action window — passing (roomId=${game.roomId}, playerIndex=${playerIndex}, turn=${turnNumber}, phase=${game.state.phase}, hasActionWindow=true) ts=${Date.now()}`);
              handlePlayerAction(io, game.roomId, { type: ActionType.Pass, playerIndex }, playerIndex);
            }
          } else if (game.isBot(game.state.currentTurn) && game.state.currentTurn === playerIndex) {
            const inFinal = isInFinalDraws(game.state.wall.length, game.state.wallTail.length, game.state.retainCount);
            const currentActions = getPostDrawActions(game, playerIndex, inFinal);
            console.warn(`[Bot:FALLBACK] ${tag} Stale safety re-trigger on own turn (roomId=${game.roomId}, playerIndex=${playerIndex}, turn=${turnNumber}, phase=${game.state.phase}, hasActionWindow=false) ts=${Date.now()}`);
            try {
              emitOrBotAction(io, game, playerIndex, currentActions, undefined, depth + 1);
            } catch (e) {
              console.error(`${tag} Stale safety re-trigger failed:`, e);
              const player = game.state.players[playerIndex];
              handlePlayerAction(io, game.roomId, emergencyDiscard(player.hand, playerIndex, game.state.gold), playerIndex);
            }
          } else {
            console.log(tag + " Stale bail — bot turn is over, no action needed");
          }
        }
        return;
      }
      if (game.state.phase !== GamePhase.Playing) {
        console.log(`${tag} Safety timer skipped — game phase=${game.state.phase} ts=${Date.now()}`);
        return;
      }
      if (game.state.currentTurn !== playerIndex && !activeWindows.has(game.roomId)) {
        console.log(`${tag} Safety timer skipped — not this bot's turn (currentTurn=${game.state.currentTurn}) ts=${Date.now()}`);
        return;
      }
      acted = true;
      const safetyWindow = activeWindows.get(game.roomId);
      if (safetyWindow) {
        if (!safetyWindow.isPending(playerIndex)) {
          console.log(`${tag} Safety timer — bot already responded to action window, skipping ts=${Date.now()}`);
        } else {
          console.warn(`[Bot:SAFETY] ${tag} Safety timeout during action window — passing (roomId=${game.roomId}, playerIndex=${playerIndex}, turn=${turnNumber}, phase=${game.state.phase}, version=${version}, hasActionWindow=true) ts=${Date.now()}`);
          try {
            handlePlayerAction(io, game.roomId, { type: ActionType.Pass, playerIndex }, playerIndex);
          } catch (e) {
            console.error(`${tag} Safety timeout Pass fallback failed:`, e);
          }
        }
      } else {
        console.warn(`[Bot:SAFETY] ${tag} Safety timeout — forcing emergency discard (roomId=${game.roomId}, playerIndex=${playerIndex}, turn=${turnNumber}, phase=${game.state.phase}, version=${version}, hasActionWindow=false) ts=${Date.now()}`);
        try {
          const player = game.state.players[playerIndex];
          handlePlayerAction(io, game.roomId, emergencyDiscard(player.hand, playerIndex, game.state.gold), playerIndex);
        } catch (e) {
          console.error(`${tag} Safety timeout fallback failed:`, e);
        }
      }
    }, 5_000);

    mainTimer = setTimeout(() => {
      try {
      const currentV = getBotVersion(game.roomId, playerIndex);
      console.log(`${tag} Callback fired (version=${version}, current=${currentV}, phase=${game.state.phase}) ts=${Date.now()}`);
      // Stale check: if version has advanced, another action superseded this one
      if (currentV !== version) {
        console.log(`${tag} STALE — bailing (had=${version}, now=${currentV}) ts=${Date.now()}`);
        // Re-trigger based on context
        if (game.state.phase === GamePhase.Playing) {
          const window = activeWindows.get(game.roomId);
          if (window) {
            if (!window.isPending(playerIndex)) {
              console.log(`${tag} Stale callback — bot already responded to action window, skipping ts=${Date.now()}`);
            } else {
              console.warn(`[Bot:FALLBACK] ${tag} Stale callback re-trigger during action window — passing (roomId=${game.roomId}, playerIndex=${playerIndex}, turn=${turnNumber}, phase=${game.state.phase}, hasActionWindow=true) ts=${Date.now()}`);
              handlePlayerAction(io, game.roomId, { type: ActionType.Pass, playerIndex }, playerIndex);
            }
          } else if (game.isBot(game.state.currentTurn) && game.state.currentTurn === playerIndex) {
            const inFinal = isInFinalDraws(game.state.wall.length, game.state.wallTail.length, game.state.retainCount);
            const currentActions = getPostDrawActions(game, playerIndex, inFinal);
            console.warn(`[Bot:FALLBACK] ${tag} Stale callback re-trigger on own turn (roomId=${game.roomId}, playerIndex=${playerIndex}, turn=${turnNumber}, phase=${game.state.phase}, hasActionWindow=false) ts=${Date.now()}`);
            try {
              emitOrBotAction(io, game, playerIndex, currentActions, undefined, depth + 1);
            } catch (e) {
              console.error(`${tag} Stale callback re-trigger failed:`, e);
              const player = game.state.players[playerIndex];
              handlePlayerAction(io, game.roomId, emergencyDiscard(player.hand, playerIndex, game.state.gold), playerIndex);
            }
          } else {
            console.log(tag + " Stale bail — bot turn is over, no action needed");
          }
        }
        return;
      }
        // Restore the snapshotted drawn tile ID so downstream handlers
        // (e.g. handleSelfDrawHu, getPostDrawActions) see the correct value
        game.lastDrawnTileIds[playerIndex] = snapshotDrawnTileId;
        // Check if game state is still valid for this bot action
        if (game.state.phase !== GamePhase.Playing) {
          console.warn(`${tag} Action skipped: phase=${game.state.phase}, attempting Pass fallback ts=${Date.now()}`);
          try {
            handlePlayerAction(io, game.roomId, { type: ActionType.Pass, playerIndex }, playerIndex);
          } catch (e) {
            console.error(`${tag} Phase-check Pass fallback failed:`, e);
          }
          return;
        }
        const player = game.state.players[playerIndex];
        const botContext: BotContext = {
          wallRemaining: game.state.wall.length + game.state.wallTail.length - game.state.retainCount,
          opponentMelds: game.state.players
            .filter((_, i) => i !== playerIndex)
            .map(p => p.melds),
          opponentDiscards: game.state.players
            .filter((_, i) => i !== playerIndex)
            .map(p => p.discards),
        };
        // Re-query actions at execution time — the captured `actions` may be stale
        // since 300-800ms have passed since emitOrBotAction was called
        const inFinal = isInFinalDraws(game.state.wall.length, game.state.wallTail.length, game.state.retainCount);
        const activeWindow = activeWindows.get(game.roomId);
        if (activeWindow && !activeWindow.isPending(playerIndex)) {
          console.log(`${tag} Bot already responded to action window, skipping ts=${Date.now()}`);
          return;
        }
        const freshActions = activeWindow ? actions : getPostDrawActions(game, playerIndex, inFinal);
        const botAction = decideBotAction(player.hand, player.melds, freshActions, playerIndex, game.state.gold, lastDiscardTile, botContext);
        console.log(`${tag} Decided action=${botAction.type} (version=${version}) ts=${Date.now()}`);
        const success = handlePlayerAction(io, game.roomId, botAction, playerIndex);
        if (success) acted = true;  // Only mark acted after successful action — safety timer can still rescue on failure
        if (!success) {
          console.warn(`${tag} handlePlayerAction rejected bot action=${botAction.type} — entering fallback chain ts=${Date.now()}`);
          throw new Error(`Bot action ${botAction.type} was rejected by handlePlayerAction`);
        }
      } catch (err) {
        clearTimeout(safetyTimer);
        console.error(`${tag} Bot callback unhandled error:`, err);
        // Fallback: try pass first, then discard if pass not allowed
        console.warn(`${tag} Entering fallback chain (canPass=${actions.canPass}) ts=${Date.now()}`);
        if (game.state.phase !== GamePhase.Playing) {
          console.warn(`${tag} Fallback skipped — game ended (phase=${game.state.phase})`);
          return;
        }
        try {
          if (actions.canPass) {
            handlePlayerAction(io, game.roomId, { type: ActionType.Pass, playerIndex }, playerIndex);
          } else {
            const player = game.state.players[playerIndex];
            console.warn(`${tag} Fallback: emergency discard ts=${Date.now()}`);
            handlePlayerAction(io, game.roomId, emergencyDiscard(player.hand, playerIndex, game.state.gold), playerIndex);
          }
        } catch (fallbackErr) {
          console.error(`${tag} Fallback also failed:`, fallbackErr);
          // Last resort: force Pass to prevent permanent hang
          if (game.state.phase !== GamePhase.Playing) {
            console.warn(`${tag} Last-resort skipped — game ended (phase=${game.state.phase})`);
            return;
          }
          try {
            // Last resort: force Pass unconditionally regardless of canPass
            console.warn(`${tag} Last-resort Pass (forced, ignoring canPass=${actions.canPass}) ts=${Date.now()}`);
            handlePlayerAction(io, game.roomId, { type: ActionType.Pass, playerIndex }, playerIndex);
          } catch (lastResortErr) {
            console.error(`${tag} Last-resort Pass also failed:`, lastResortErr);
            // Force advance turn as absolute last resort
            console.warn(`${tag} Force advancing turn ts=${Date.now()}`);
            advanceToNextPlayer(io, game, playerIndex);
          }
        }
      } finally {
        clearTimeout(safetyTimer);
      }
    }, delay);
  } else {
    console.log(_tag + " branch=human");
    const socketId = game.getSocketId(playerIndex);
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      console.log(_tag + " branch=human-socket-found");
      socket.emit("actionRequired", actions);
    } else {
      // Disconnected human player — auto-act to prevent game freeze
      console.log(_tag + " branch=human-disconnected");
      console.warn(`[GameEngine] Player ${playerIndex} has no valid socket, auto-acting`);
      const savedTurn = game.state.currentTurn;
      setTimeout(() => {
        if (game.state.phase !== GamePhase.Playing) {
          console.log(`[GameEngine] Player ${playerIndex} auto-act skipped — game phase=${game.state.phase}`);
          return;
        }
        // Skip if turn has advanced since timeout was set (stale)
        if (game.state.currentTurn !== savedTurn) {
          console.warn(`[GameEngine] Player ${playerIndex} auto-act skipped: turn has advanced`);
          return;
        }
        const window = activeWindows.get(game.roomId);
        if (window) {
          // In action window: pass only if this player is still pending
          if (!window.isPending(playerIndex)) {
            console.log(`[GameEngine] Player ${playerIndex} auto-act skipped — already responded to action window`);
            return;
          }
          handlePlayerAction(io, game.roomId, { type: ActionType.Pass, playerIndex }, playerIndex);
        } else if (game.state.currentTurn === playerIndex) {
          // Own turn, no window: emergency discard to keep game moving
          console.warn(`[GameEngine] Player ${playerIndex} disconnected on own turn — emergency discard`);
          const player = game.state.players[playerIndex];
          const fallback = emergencyDiscard(player.hand, playerIndex, game.state.gold);
          handlePlayerAction(io, game.roomId, fallback, playerIndex);
        } else {
          console.log(`[GameEngine] Player ${playerIndex} auto-act skipped — not their turn (currentTurn=${game.state.currentTurn})`);
        }
      }, 100);
    }
  }
}
