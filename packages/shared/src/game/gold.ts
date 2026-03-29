import { isSuitedTile } from '../types/tile.js';
import type { TileInstance, SuitedTile } from '../types/tile.js';
import type { GoldState } from '../types/game.js';

export interface RevealGoldResult {
  gold: GoldState;
  wallTail: TileInstance[];
  dealerFlowers: TileInstance[];
}

export function revealGold(wallTail: TileInstance[]): RevealGoldResult {
  const updatedWallTail = [...wallTail];
  const dealerFlowers: TileInstance[] = [];

  while (updatedWallTail.length > 0) {
    const flipped = updatedWallTail.pop()!;

    if (isSuitedTile(flipped.tile)) {
      return {
        gold: {
          indicatorTile: flipped,
          wildTile: flipped.tile,
        },
        wallTail: updatedWallTail,
        dealerFlowers,
      };
    }

    // Flower tile — counts as dealer's flower, flip again
    dealerFlowers.push(flipped);
  }

  throw new Error('No suited tile found in wallTail for gold reveal');
}

export function isGoldTile(
  tileInstance: TileInstance,
  gold: GoldState,
): boolean {
  if (!isSuitedTile(tileInstance.tile)) return false;
  // Match by suit and value, but exclude the indicator tile itself
  if (tileInstance.id === gold.indicatorTile.id) return false;
  return (
    tileInstance.tile.suit === gold.wildTile.suit &&
    tileInstance.tile.value === gold.wildTile.value
  );
}
