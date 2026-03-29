import type { TileInstance, SuitedTile } from './tile.js';
import type { PlayerState } from './player.js';

export enum GamePhase {
  Dealing = 'dealing',
  FlowerReplacement = 'flowerReplacement',
  RevealingGold = 'revealingGold',
  Playing = 'playing',
  Finished = 'finished',
  Draw = 'draw',
}

export interface GoldState {
  indicatorTile: TileInstance;
  wildTile: SuitedTile;
}

export interface GameState {
  wall: TileInstance[];
  wallTail: TileInstance[];
  players: [PlayerState, PlayerState, PlayerState, PlayerState];
  currentTurn: number;
  dealerIndex: number;
  lianZhuangCount: number;
  phase: GamePhase;
  gold: GoldState | null;
  lastDiscard: { tile: TileInstance; playerIndex: number } | null;
  retainCount: number;
}
