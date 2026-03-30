import {
  createWall,
  dealTiles,
  replaceFlowers,
  revealGold,
  GamePhase,
  WindType,
  sortHand,
  findTenpaiTiles,
  checkWin,
  findAnGang,
  findBuGang,
} from "@fuzhou-mahjong/shared";
import { findRoom } from "./room.js";
import type {
  GameState,
  PlayerState,
  ClientGameState,
  TileInstance,
} from "@fuzhou-mahjong/shared";

const SEAT_WINDS = [WindType.East, WindType.South, WindType.West, WindType.North];

export class ServerGameState {
  state!: GameState;
  roomId: string;
  playerSocketIds: string[];
  playerNames: string[];
  botIndices: Set<number> = new Set();
  lastDrawnTileIds: (number | null)[] = [null, null, null, null];
  firstActionTaken = false;
  initialWallLength = 0;
  initialWallTailLength = 0;

  constructor(roomId: string, playerSocketIds: string[], playerNames?: string[], botIndices?: number[], dealerIndex?: number, lianZhuangCount?: number) {
    this.roomId = roomId;
    this.playerSocketIds = playerSocketIds;
    this.playerNames = playerNames ?? playerSocketIds.map((_, i) => `Player ${i + 1}`);
    if (botIndices) this.botIndices = new Set(botIndices);
    this.initRound(dealerIndex ?? Math.floor(Math.random() * 4), lianZhuangCount ?? 0);
  }

  private initRound(dealerIndex: number, lianZhuangCount: number): void {
    this.firstActionTaken = false;
    this.lastDrawnTileIds = [null, null, null, null];

    const { wall, wallTail } = createWall();
    const { hands, remainingWall } = dealTiles(wall, dealerIndex);

    const players: [PlayerState, PlayerState, PlayerState, PlayerState] = [
      this.createPlayer(0, dealerIndex),
      this.createPlayer(1, dealerIndex),
      this.createPlayer(2, dealerIndex),
      this.createPlayer(3, dealerIndex),
    ];

    const flowerResult = replaceFlowers(
      hands as TileInstance[][],
      wallTail,
      players,
      dealerIndex,
    );

    for (let i = 0; i < 4; i++) {
      players[i].hand = flowerResult.hands[i];
      players[i].flowers = flowerResult.players[i].flowers;
    }

    const goldResult = revealGold(flowerResult.wallTail);

    if (goldResult.dealerFlowers.length > 0) {
      players[dealerIndex].flowers.push(...goldResult.dealerFlowers);
    }

    // Track dealer's last tile before sorting (for Tianhu winning tile identification)
    const dealerHand = players[dealerIndex].hand;
    this.lastDrawnTileIds[dealerIndex] = dealerHand[dealerHand.length - 1]?.id ?? null;

    // Sort all hands by suit then value
    for (const p of players) {
      p.hand = sortHand(p.hand, goldResult.gold);
    }

    this.initialWallLength = remainingWall.length;
    this.initialWallTailLength = goldResult.wallTail.length;

    this.state = {
      wall: remainingWall,
      wallTail: goldResult.wallTail,
      players,
      currentTurn: dealerIndex,
      dealerIndex,
      lianZhuangCount,
      phase: GamePhase.Playing,
      gold: goldResult.gold,
      lastDiscard: null,
      retainCount: 18,
    };
  }

  startNextRound(): void {
    const { dealerIndex, lianZhuangCount } = this.state;
    this.initRound(dealerIndex, lianZhuangCount);
  }

  private createPlayer(index: number, dealerIndex: number): PlayerState {
    return {
      hand: [],
      melds: [],
      flowers: [],
      discards: [],
      seatWind: SEAT_WINDS[index],
      isDealer: index === dealerIndex,
      hasDiscardedGold: false,
    };
  }

  getClientGameState(playerIndex: number): ClientGameState {
    const state = this.state;
    const myPlayer = state.players[playerIndex];

    const otherPlayers = [];
    for (let i = 1; i <= 3; i++) {
      const idx = (playerIndex + i) % 4;
      const p = state.players[idx];
      otherPlayers.push({
        name: this.playerNames[idx] ?? "",
        isBot: this.botIndices.has(idx),
        flowers: p.flowers,
        melds: p.melds,
        handCount: p.hand.length,
        discards: p.discards,
        hasDiscardedGold: p.hasDiscardedGold,
      });
    }

    const cumulative = findRoom(this.roomId)?.getCumulativeData();

    return {
      phase: state.phase,
      myHand: myPlayer.hand,
      myFlowers: myPlayer.flowers,
      myMelds: myPlayer.melds,
      myName: this.playerNames[playerIndex] ?? "",
      myDiscards: myPlayer.discards,
      otherPlayers,
      currentTurn: state.currentTurn,
      myIndex: playerIndex,
      dealerIndex: state.dealerIndex,
      lianZhuangCount: state.lianZhuangCount,
      gold: state.gold,
      wallRemaining: state.wall.length + state.wallTail.length,
      wallDrawCount: this.initialWallLength - state.wall.length,
      wallSupplementCount: this.initialWallTailLength - state.wallTail.length,
      lastDiscard: state.lastDiscard,
      tenpaiTiles: findTenpaiTiles(myPlayer.hand, myPlayer.melds, state.gold),
      lastDrawnTileId: this.lastDrawnTileIds[playerIndex],
      myHasDiscardedGold: myPlayer.hasDiscardedGold,
      cumulativeScores: cumulative?.scores ?? [0, 0, 0, 0],
      roundsPlayed: cumulative?.roundsPlayed ?? 0,
    };
  }

  getInitialDealerActions(): import("@fuzhou-mahjong/shared").AvailableActions {
    const dealer = this.state.players[this.state.dealerIndex];
    const drawnId = this.lastDrawnTileIds[this.state.dealerIndex];
    const lastTile = drawnId != null
      ? dealer.hand.find((t) => t.id === drawnId) ?? dealer.hand[dealer.hand.length - 1]
      : dealer.hand[dealer.hand.length - 1];

    let canHu = false;
    if (lastTile) {
      const winResult = checkWin(dealer, lastTile, this.state.gold, {
        isSelfDraw: true,
        isFirstAction: true,
        isDealer: true,
        isRobbingKong: false,
        totalFlowers: dealer.flowers.length,
        totalGangs: 0,
      });
      canHu = winResult.isWin;
    }

    const anGangOptions = findAnGang(dealer.hand, this.state.gold);
    const buGangOptions = findBuGang(dealer.hand, dealer.melds, this.state.gold);
    const hasGangOptions = anGangOptions.length > 0 || buGangOptions.length > 0;

    return {
      canDraw: false,
      canDiscard: true,
      chiOptions: [],
      canPeng: false,
      canMingGang: false,
      anGangOptions,
      buGangOptions,
      canHu,
      canPass: canHu || hasGangOptions,
    };
  }

  getSocketId(playerIndex: number): string {
    return this.playerSocketIds[playerIndex];
  }

  getPlayerIndex(socketId: string): number {
    return this.playerSocketIds.indexOf(socketId);
  }

  updateSocketId(playerIndex: number, newSocketId: string): void {
    this.playerSocketIds[playerIndex] = newSocketId;
  }

  isBot(playerIndex: number): boolean {
    return this.botIndices.has(playerIndex);
  }
}

// ─── Game Store ──────────────────────────────────────────────────

const games = new Map<string, ServerGameState>();

export function createGame(
  roomId: string,
  playerSocketIds: string[],
  playerNames?: string[],
  botIndices?: number[],
): ServerGameState {
  const game = new ServerGameState(roomId, playerSocketIds, playerNames, botIndices);
  games.set(roomId, game);
  return game;
}

export function getGame(roomId: string): ServerGameState | undefined {
  return games.get(roomId);
}

export function deleteGame(roomId: string): void {
  games.delete(roomId);
  onGameDeleted?.(roomId);
}

/** Hook called when a game is deleted, used by gameEngine to clean up per-room state. */
let onGameDeleted: ((roomId: string) => void) | null = null;
export function setOnGameDeleted(cb: (roomId: string) => void): void {
  onGameDeleted = cb;
}
