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
} from "@fuzhou-mahjong/shared";
import { ServerGameState, getGame } from "./gameState.js";
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
  } else {
    // Human action: resolve by socket ID
    room = findRoomBySocket(socketIdOrRoomId);
    if (!room) return;
    game = getGame(room.id);
    if (!game || game.state.phase !== GamePhase.Playing) return;
    playerIndex = game.getPlayerIndex(socketIdOrRoomId);
    if (playerIndex === -1) return;
  }

  // Check if there's an active action window
  const window = activeWindows.get(room.id);
  if (window) {
    window.addResponse(playerIndex, action);
    return;
  }

  // Direct actions (during player's own turn)
  const state = game.state;
  if (state.currentTurn !== playerIndex) return;

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
    default:
      break;
  }
}

function handleDiscard(
  io: GameServer,
  game: ServerGameState,
  playerIndex: number,
  tile: TileInstance,
): void {
  const state = game.state;
  const player = state.players[playerIndex];

  // Remove tile from hand
  const tileIdx = player.hand.findIndex((t) => t.id === tile.id);
  if (tileIdx === -1) return;
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
  if (matching.length < 4) return;

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
  if (meldIdx === -1) return;

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
  if (player.hand.length === 0) return;

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
  }
}

function gangDraw(
  io: GameServer,
  game: ServerGameState,
  playerIndex: number,
): void {
  const state = game.state;
  if (state.wallTail.length === 0) {
    endGameDraw(io, game);
    return;
  }

  const tile = state.wallTail.pop()!;
  const player = state.players[playerIndex];

  if (!isSuitedTile(tile.tile)) {
    player.flowers.push(tile);
    // Draw another replacement
    gangDraw(io, game, playerIndex);
    return;
  }

  player.hand.push(tile);
  player.hand = sortHand(player.hand, state.gold);
  game.lastDrawnTileIds[playerIndex] = tile.id;
  broadcastState(io, game);

  // After gang draw, player gets actions (discard, check hu/gang)
  const actions = getPostDrawActions(game, playerIndex, false);
  emitOrBotAction(io, game, playerIndex, actions);
}

// ─── Action Resolution ──────────────────────────────────────────

function resolveActionWindow(
  io: GameServer,
  game: ServerGameState,
  winner: PendingAction | null,
  discarderIndex: number,
  discardTile: TileInstance,
): void {
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
      io.to(game.getSocketId(i)).emit("gameStateUpdate", game.getClientGameState(i));
    }
  }
}

/**
 * Emit actionRequired to a player, or auto-respond if bot.
 */
function emitOrBotAction(
  io: GameServer,
  game: ServerGameState,
  playerIndex: number,
  actions: import("@fuzhou-mahjong/shared").AvailableActions,
  lastDiscardTile?: TileInstance,
): void {
  if (game.isBot(playerIndex)) {
    setTimeout(() => {
      const player = game.state.players[playerIndex];
      const botAction = decideBotAction(player.hand, player.melds, actions, playerIndex, game.state.gold, lastDiscardTile);
      handlePlayerAction(io, game.roomId, botAction, playerIndex);
    }, 300 + Math.random() * 500);
  } else {
    io.to(game.getSocketId(playerIndex)).emit("actionRequired", actions);
  }
}
