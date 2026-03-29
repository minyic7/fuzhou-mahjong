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
  AvailableActions,
  TileInstance,
} from "@fuzhou-mahjong/shared";

const SEAT_WINDS = [WindType.East, WindType.South, WindType.West, WindType.North];

export class ServerGameState {
  state: GameState;
  roomId: string;
  playerSocketIds: string[];

  constructor(roomId: string, playerSocketIds: string[]) {
    this.roomId = roomId;
    this.playerSocketIds = playerSocketIds;

    // 1. Create and shuffle wall
    const { wall, wallTail } = createWall();

    // 2. Random dealer
    const dealerIndex = Math.floor(Math.random() * 4);

    // 3. Deal tiles
    const { hands, remainingWall } = dealTiles(wall, dealerIndex);

    // 4. Initialize player states
    const players: [PlayerState, PlayerState, PlayerState, PlayerState] = [
      this.createPlayer(0, dealerIndex),
      this.createPlayer(1, dealerIndex),
      this.createPlayer(2, dealerIndex),
      this.createPlayer(3, dealerIndex),
    ];

    // 5. Flower replacement
    const flowerResult = replaceFlowers(
      hands as TileInstance[][],
      wallTail,
      players,
      dealerIndex,
    );

    // Update player hands and flowers
    for (let i = 0; i < 4; i++) {
      players[i].hand = flowerResult.hands[i];
      players[i].flowers = flowerResult.players[i].flowers;
    }

    // 6. Reveal gold
    const goldResult = revealGold(flowerResult.wallTail);

    // 7. Add dealer flowers from gold reveal
    if (goldResult.dealerFlowers.length > 0) {
      players[dealerIndex].flowers.push(...goldResult.dealerFlowers);
    }

    // 8. Build game state
    this.state = {
      wall: remainingWall,
      wallTail: goldResult.wallTail,
      players,
      currentTurn: dealerIndex,
      dealerIndex,
      lianZhuangCount: 0,
      phase: GamePhase.Playing,
      gold: goldResult.gold,
      lastDiscard: null,
      retainCount: 18,
    };
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
        name: "",
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

  getAvailableActions(playerIndex: number): AvailableActions {
    const isMyTurn = this.state.currentTurn === playerIndex;

    return {
      canDraw: false,
      canDiscard: isMyTurn && this.state.phase === GamePhase.Playing,
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
}

// ─── Game Store ──────────────────────────────────────────────────

const games = new Map<string, ServerGameState>();

export function createGame(
  roomId: string,
  playerSocketIds: string[],
): ServerGameState {
  const game = new ServerGameState(roomId, playerSocketIds);
  games.set(roomId, game);
  return game;
}

export function getGame(roomId: string): ServerGameState | undefined {
  return games.get(roomId);
}

export function deleteGame(roomId: string): void {
  games.delete(roomId);
}
