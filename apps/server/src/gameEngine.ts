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
    if (!this.pendingPlayers.has(playerIndex)) return false;
    this.responses.set(playerIndex, action);
    this.pendingPlayers.delete(playerIndex);
    this.tryResolve();
    return true;
  }

  private tryResolve(): void {
    if (this.pendingPlayers.size > 0) return;
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

  cancel(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }
}

// ─── Game Engine ─────────────────────────────────────────────────

const activeWindows = new Map<string, ActionWindow>();

// ─── Bot Watchdog Timer ──────────────────────────────────────────
const BOT_WATCHDOG_MS = 10_000;
const botWatchdogs = new Map<string, NodeJS.Timeout>();

/** Last io reference, captured so the watchdog can act without closure. */
let lastIoRef: GameServer | null = null;

function startBotWatchdog(roomId: string, playerIndex: number, io: GameServer): void {
  clearBotWatchdog(roomId);
  lastIoRef = io;

  const watchdog = setTimeout(() => {
    botWatchdogs.delete(roomId);
    const game = getGame(roomId);
    if (!game || game.state.phase !== GamePhase.Playing) {
      console.log(`[Bot:${roomId}:p${playerIndex}:watchdog] Fired but game ended (phase=${game?.state.phase ?? "deleted"}) ts=${Date.now()}`);
      return;
    }
    if (!game.isBot(game.state.currentTurn)) {
      console.log(`[Bot:${roomId}:p${playerIndex}:watchdog] Fired but currentTurn=${game.state.currentTurn} is not a bot ts=${Date.now()}`);
      return;
    }

    const turn = game.state.currentTurn;
    const player = game.state.players[turn];
    console.warn(
      `[Bot:${roomId}:p${turn}:t${turn}:watchdog] Exceeded ${BOT_WATCHDOG_MS}ms — forcing default action. ` +
      `phase=${game.state.phase}, handSize=${player.hand.length}, ` +
      `wallRemaining=${game.state.wall.length + game.state.wallTail.length}, ` +
      `currentTurn=${turn}, pendingWindow=${activeWindows.has(roomId)}, ts=${Date.now()}`,
    );

    try {
      // If there's a stale action window, force-resolve it
      const window = activeWindows.get(roomId);
      if (window) {
        console.warn(`[Bot:${roomId}:p${turn}:watchdog] Cancelling stale action window`);
        window.cancel();
        activeWindows.delete(roomId);
      }

      const fallback = emergencyDiscard(player.hand, playerIndex, game.state.gold);
      console.log(`[Bot:${roomId}:p${turn}:watchdog] Emergency discard ts=${Date.now()}`);
      handlePlayerAction(io, roomId, fallback, turn);
    } catch (e) {
      console.error(`[Bot:${roomId}:p${turn}:watchdog] Fallback failed:`, e);
      try {
        advanceToNextPlayer(io, game, turn);
      } catch (e2) {
        console.error(`[Bot:${roomId}:p${turn}:watchdog] advanceToNextPlayer also failed:`, e2);
      }
    }
  }, BOT_WATCHDOG_MS);

  botWatchdogs.set(roomId, watchdog);
}

function clearBotWatchdog(roomId: string): void {
  const existing = botWatchdogs.get(roomId);
  if (existing) {
    clearTimeout(existing);
    botWatchdogs.delete(roomId);
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
  clearBotWatchdog(roomId);
  const window = activeWindows.get(roomId);
  if (window) {
    window.cancel();
    activeWindows.delete(roomId);
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
): void {
  let room: ReturnType<typeof findRoomBySocket>;
  let game: ReturnType<typeof getGame>;
  let playerIndex: number;

  if (botPlayerIndex !== undefined) {
    // Bot action: resolve by room ID directly
    game = getGame(socketIdOrRoomId);
    if (!game || game.state.phase !== GamePhase.Playing) return;
    playerIndex = botPlayerIndex;
    room = findRoom(game.roomId);
    if (!room) return;
    // Bots don't need error feedback
  } else {
    // Human action: resolve by socket ID
    room = findRoomBySocket(socketIdOrRoomId);
    if (!room) return;
    game = getGame(room.id);
    if (!game || game.state.phase !== GamePhase.Playing) {
      const socket = io.sockets.sockets.get(socketIdOrRoomId);
      socket?.emit('actionError', { message: 'Invalid game phase', code: 'WRONG_PHASE' });
      return;
    }
    playerIndex = game.getPlayerIndex(socketIdOrRoomId);
    if (playerIndex === -1) return;
  }

  // Clear watchdog on any successful action processing for this room
  clearBotWatchdog(room.id);

  // Check if there's an active action window
  const window = activeWindows.get(room.id);
  if (window) {
    window.addResponse(playerIndex, action);
    return;
  }

  // Direct actions (during player's own turn)
  const state = game.state;
  if (state.currentTurn !== playerIndex) {
    if (botPlayerIndex !== undefined) {
      console.warn(`Bot ${playerIndex} action rejected: not their turn (current: ${state.currentTurn})`);
    } else {
      const socket = io.sockets.sockets.get(socketIdOrRoomId);
      socket?.emit('actionError', { message: 'Not your turn', code: 'WRONG_TURN' });
    }
    return;
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
      console.warn(`[GameEngine] Unhandled action type in handlePlayerAction: ${action.type}`);
      break;
  }
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
      activeWindows.delete(game.roomId);
      resolveActionWindow(io, game, winner, playerIndex, tile);
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
      activeWindows.delete(game.roomId);
      if (winner && winner.action.type === ActionType.Hu) {
        endGameWin(io, game, winner.playerIndex, tile, false);
      } else {
        // No one robbed, proceed with bu gang
        executeBuGang(io, game, playerIndex, tile, meldIdx);
      }
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
  while (true) {
    if (state.wallTail.length === 0) {
      endGameDraw(io, game);
      return;
    }

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
      endGameWin(io, game, winner.playerIndex, discardTile, false);
      break;

    case ActionType.Peng: {
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
      emitOrBotAction(io, game, winner.playerIndex,
        getPostClaimActions(game, winner.playerIndex));
      break;
    }

    case ActionType.MingGang: {
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
      gangDraw(io, game, winner.playerIndex);
      break;
    }

    case ActionType.Chi: {
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
      emitOrBotAction(io, game, winner.playerIndex,
        getPostClaimActions(game, winner.playerIndex));
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
): void {
  const state = game.state;
  state.phase = GamePhase.Finished;

  const winner = state.players[winnerIndex];
  const winResult = checkWin(winner, winningTile, state.gold, {
    isSelfDraw,
    isFirstAction: !game.firstActionTaken,
    isDealer: winner.isDealer,
    isRobbingKong: false,
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
): void {
  if (game.isBot(playerIndex)) {
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

    const safetyTimer = setTimeout(() => {
      if (acted) {
        console.log(`${tag} Safety timer fired but already acted (version=${version}) ts=${Date.now()}`);
        return;
      }
      const currentV = getBotVersion(game.roomId, playerIndex);
      if (currentV !== version) {
        console.log(`${tag} Safety timer STALE — bailing (had=${version}, now=${currentV}) ts=${Date.now()}`);
        // Re-trigger if game is stuck
        if (game.state.phase === GamePhase.Playing) {
          const window = activeWindows.get(game.roomId);
          if (window) {
            // Action window active: check if this bot has pending actions, otherwise Pass
            console.warn(`[Bot:FALLBACK] ${tag} Stale safety re-trigger during action window — passing (roomId=${game.roomId}, playerIndex=${playerIndex}, turn=${turnNumber}, phase=${game.state.phase}, hasActionWindow=true) ts=${Date.now()}`);
            handlePlayerAction(io, game.roomId, { type: ActionType.Pass, playerIndex }, playerIndex);
          } else if (game.isBot(game.state.currentTurn) && game.state.currentTurn === playerIndex) {
            const currentActions = getPostDrawActions(game, playerIndex, false);
            console.warn(`[Bot:FALLBACK] ${tag} Stale safety re-trigger on own turn (roomId=${game.roomId}, playerIndex=${playerIndex}, turn=${turnNumber}, phase=${game.state.phase}, hasActionWindow=false) ts=${Date.now()}`);
            emitOrBotAction(io, game, playerIndex, currentActions);
          }
        }
        return;
      }
      if (game.state.phase !== GamePhase.Playing) {
        console.log(`${tag} Safety timer skipped — game phase=${game.state.phase} ts=${Date.now()}`);
        return;
      }
      acted = true;
      const safetyWindow = activeWindows.get(game.roomId);
      if (safetyWindow) {
        console.warn(`[Bot:FALLBACK] ${tag} Safety timeout during action window — passing (roomId=${game.roomId}, playerIndex=${playerIndex}, turn=${turnNumber}, phase=${game.state.phase}, hasActionWindow=true) ts=${Date.now()}`);
        try {
          handlePlayerAction(io, game.roomId, { type: ActionType.Pass, playerIndex }, playerIndex);
        } catch (e) {
          console.error(`${tag} Safety timeout Pass fallback failed:`, e);
        }
      } else {
        console.warn(`[Bot:FALLBACK] ${tag} Safety timeout — forcing emergency discard (roomId=${game.roomId}, playerIndex=${playerIndex}, turn=${turnNumber}, phase=${game.state.phase}, hasActionWindow=false, version=${version}) ts=${Date.now()}`);
        try {
          const player = game.state.players[playerIndex];
          handlePlayerAction(io, game.roomId, emergencyDiscard(player.hand, playerIndex, game.state.gold), playerIndex);
        } catch (e) {
          console.error(`${tag} Safety timeout fallback failed:`, e);
        }
      }
    }, 5_000);

    setTimeout(() => {
      acted = true;  // FIRST — prevent safety timer from also firing
      clearTimeout(safetyTimer);
      const currentV = getBotVersion(game.roomId, playerIndex);
      console.log(`${tag} Callback fired (version=${version}, current=${currentV}, phase=${game.state.phase}) ts=${Date.now()}`);
      // Stale check: if version has advanced, another action superseded this one
      if (currentV !== version) {
        console.log(`${tag} STALE — bailing (had=${version}, now=${currentV}) ts=${Date.now()}`);
        // Re-trigger based on context
        if (game.state.phase === GamePhase.Playing) {
          const window = activeWindows.get(game.roomId);
          if (window) {
            console.warn(`[Bot:FALLBACK] ${tag} Stale callback re-trigger during action window — passing (roomId=${game.roomId}, playerIndex=${playerIndex}, turn=${turnNumber}, phase=${game.state.phase}, hasActionWindow=true) ts=${Date.now()}`);
            handlePlayerAction(io, game.roomId, { type: ActionType.Pass, playerIndex }, playerIndex);
          } else if (game.isBot(game.state.currentTurn) && game.state.currentTurn === playerIndex) {
            const currentActions = getPostDrawActions(game, playerIndex, false);
            console.warn(`[Bot:FALLBACK] ${tag} Stale callback re-trigger on own turn (roomId=${game.roomId}, playerIndex=${playerIndex}, turn=${turnNumber}, phase=${game.state.phase}, hasActionWindow=false) ts=${Date.now()}`);
            emitOrBotAction(io, game, playerIndex, currentActions);
          }
        }
        return;
      }
      try {
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
        const botAction = decideBotAction(player.hand, player.melds, actions, playerIndex, game.state.gold, lastDiscardTile, botContext);
        console.log(`${tag} Decided action=${botAction.type} (version=${version}) ts=${Date.now()}`);
        handlePlayerAction(io, game.roomId, botAction, playerIndex);
      } catch (err) {
        console.error(`${tag} Action error:`, err);
        // Fallback: try pass first, then discard if pass not allowed
        console.warn(`${tag} Entering fallback chain (canPass=${actions.canPass}) ts=${Date.now()}`);
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
          try {
            console.warn(`${tag} Last-resort Pass ts=${Date.now()}`);
            handlePlayerAction(io, game.roomId, { type: ActionType.Pass, playerIndex }, playerIndex);
          } catch (lastResortErr) {
            console.error(`${tag} Last-resort Pass also failed:`, lastResortErr);
            // Force advance turn as absolute last resort
            console.warn(`${tag} Force advancing turn ts=${Date.now()}`);
            advanceToNextPlayer(io, game, playerIndex);
          }
        }
      }
    }, delay);
  } else {
    const socketId = game.getSocketId(playerIndex);
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit("actionRequired", actions);
    } else {
      // Disconnected human player — auto-act to prevent game freeze
      console.warn(`[GameEngine] Player ${playerIndex} has no valid socket, auto-acting`);
      const savedTurn = game.state.currentTurn;
      setTimeout(() => {
        if (game.state.phase !== GamePhase.Playing) return;
        // Skip if turn has advanced since timeout was set (stale)
        if (game.state.currentTurn !== savedTurn) {
          console.warn(`[GameEngine] Player ${playerIndex} auto-act skipped: turn has advanced`);
          return;
        }
        const window = activeWindows.get(game.roomId);
        if (window) {
          // In action window: pass
          handlePlayerAction(io, game.roomId, { type: ActionType.Pass, playerIndex }, playerIndex);
        } else if (game.state.currentTurn === playerIndex) {
          // Own turn, no window: emergency discard to keep game moving
          console.warn(`[GameEngine] Player ${playerIndex} disconnected on own turn — emergency discard`);
          const player = game.state.players[playerIndex];
          const fallback = emergencyDiscard(player.hand, playerIndex, game.state.gold);
          handlePlayerAction(io, game.roomId, fallback, playerIndex);
        }
      }, 100);
    }
  }
}
