import { isFlowerTile } from '../types/tile.js';
import type { TileInstance } from '../types/tile.js';
import type { PlayerState } from '../types/player.js';

export interface FlowerReplacementResult {
  hands: TileInstance[][];
  wallTail: TileInstance[];
  players: PlayerState[];
}

export function replaceFlowers(
  hands: TileInstance[][],
  wallTail: TileInstance[],
  players: PlayerState[],
  dealerIndex: number,
): FlowerReplacementResult {
  const updatedHands = hands.map(h => [...h]);
  const updatedWallTail = [...wallTail];
  const updatedPlayers = players.map(p => ({ ...p, flowers: [...p.flowers] }));

  // Player processing order: dealer first, then counterclockwise
  const order = [0, 1, 2, 3].map(i => (dealerIndex + i) % 4);

  let hasNewFlowers = true;

  while (hasNewFlowers) {
    hasNewFlowers = false;

    for (const playerIdx of order) {
      // Find all flower tiles in this player's hand
      const flowerIndices: number[] = [];
      for (let i = 0; i < updatedHands[playerIdx].length; i++) {
        if (isFlowerTile(updatedHands[playerIdx][i].tile)) {
          flowerIndices.push(i);
        }
      }

      if (flowerIndices.length === 0) continue;

      // Remove flowers from hand (reverse order to preserve indices)
      const flowers: TileInstance[] = [];
      for (let i = flowerIndices.length - 1; i >= 0; i--) {
        flowers.unshift(updatedHands[playerIdx].splice(flowerIndices[i], 1)[0]);
      }

      // Add to player's flower area
      updatedPlayers[playerIdx].flowers.push(...flowers);

      // Draw replacements from wall tail
      for (let i = 0; i < flowers.length; i++) {
        if (updatedWallTail.length === 0) break;
        const replacement = updatedWallTail.pop()!;
        updatedHands[playerIdx].push(replacement);

        // If replacement is also a flower, it will be caught in the next round
        if (isFlowerTile(replacement.tile)) {
          hasNewFlowers = true;
        }
      }
    }
  }

  return {
    hands: updatedHands,
    wallTail: updatedWallTail,
    players: updatedPlayers,
  };
}
