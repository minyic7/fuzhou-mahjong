import type { TileInstance } from '../types/tile.js';
import { createAllTiles, shuffleTiles } from './tiles.js';

const WALL_TAIL_SIZE = 40;

export interface WallSetup {
  wall: TileInstance[];
  wallTail: TileInstance[];
}

export function createWall(): WallSetup {
  const allTiles = shuffleTiles(createAllTiles());
  const splitPoint = allTiles.length - WALL_TAIL_SIZE;
  return {
    wall: allTiles.slice(0, splitPoint),
    wallTail: allTiles.slice(splitPoint),
  };
}

export interface DealResult {
  hands: [TileInstance[], TileInstance[], TileInstance[], TileInstance[]];
  remainingWall: TileInstance[];
}

export function dealTiles(wall: TileInstance[], dealerIndex: number): DealResult {
  const hands: [TileInstance[], TileInstance[], TileInstance[], TileInstance[]] = [[], [], [], []];
  let drawIndex = 0;

  // Player order: dealer first, then counterclockwise
  const order = [0, 1, 2, 3].map(i => (dealerIndex + i) % 4);

  // 4 rounds, 4 tiles each per player
  for (let round = 0; round < 4; round++) {
    for (const playerIdx of order) {
      for (let t = 0; t < 4; t++) {
        hands[playerIdx].push(wall[drawIndex++]);
      }
    }
  }

  // Dealer draws 1 extra tile (跳牌)
  hands[dealerIndex].push(wall[drawIndex++]);

  return {
    hands,
    remainingWall: wall.slice(drawIndex),
  };
}
