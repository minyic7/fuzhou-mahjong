import {
  createWall,
  dealTiles,
  replaceFlowers,
  revealGold,
  GamePhase,
  WindType,
} from "@fuzhou-mahjong/shared";
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
  firstActionTaken = false;

  constructor(roomId: string, playerSocketIds: string[], playerNames?: string[], botIndices?: number[], dealerIndex?: number, lianZhuangCount?: number) {
    this.roomId = roomId;
    this.playerSocketIds = playerSocketIds;
    this.playerNames = playerNames ?? playerSocketIds.map((_, i) => `Player ${i + 1}`);
    if (botIndices) this.botIndices = new Set(botIndices);
    this.initRound(dealerIndex ?? Math.floor(Math.random() * 4), lianZhuangCount ?? 0);
  }

  private initRound(dealerIndex: number, lianZhuangCount: number): void {
    this.firstActionTaken = false;

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
      });
    }

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
      lastDiscard: state.lastDiscard,
    };
  }

  getInitialDealerActions(): import("@fuzhou-mahjong/shared").AvailableActions {
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
}
