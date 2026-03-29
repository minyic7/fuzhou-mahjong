import { isSuitedTile, Suit } from '../types/tile.js';
import type { TileInstance, SuitedTile } from '../types/tile.js';
import type { GoldState } from '../types/game.js';
import type { Meld } from '../types/meld.js';
import { isGoldTile } from './gold.js';
import { isValidHand } from './winning.js';

const SUIT_ORDER: Record<string, number> = { wan: 0, bing: 1, tiao: 2 };

/**
 * Sort hand tiles by suit then value. Gold tiles go to the end.
 */
export function sortHand(hand: TileInstance[], gold: GoldState | null): TileInstance[] {
  return [...hand].sort((a, b) => {
    if (!isSuitedTile(a.tile) || !isSuitedTile(b.tile)) return 0;
    const aGold = gold && isGoldTile(a, gold);
    const bGold = gold && isGoldTile(b, gold);
    if (aGold && !bGold) return 1;
    if (!aGold && bGold) return -1;
    const aSuit = SUIT_ORDER[a.tile.suit] ?? 0;
    const bSuit = SUIT_ORDER[b.tile.suit] ?? 0;
    if (aSuit !== bSuit) return aSuit - bSuit;
    return a.tile.value - b.tile.value;
  });
}

/**
 * Check if player is tenpai (1 tile away from winning).
 * Returns the list of tiles that would complete the hand.
 */
export function findTenpaiTiles(
  hand: TileInstance[],
  melds: Meld[],
  gold: GoldState | null,
): SuitedTile[] {
  const setsNeeded = 5 - melds.length;
  const waitingTiles: SuitedTile[] = [];
  const suits = [Suit.Wan, Suit.Bing, Suit.Tiao] as const;

  // Try adding each possible suited tile and check if hand wins
  for (const suit of suits) {
    for (let value = 1; value <= 9; value++) {
      const testTile: SuitedTile = { kind: 'suited', suit, value: value as SuitedTile['value'] };

      // Get non-gold suited tiles from hand
      const handSuited: SuitedTile[] = [];
      let goldCount = 0;
      for (const t of hand) {
        if (!isSuitedTile(t.tile)) continue;
        if (gold && isGoldTile(t, gold)) { goldCount++; continue; }
        handSuited.push(t.tile);
      }

      // Add the test tile
      handSuited.push(testTile);

      if (isValidHand(handSuited, goldCount, setsNeeded)) {
        // Avoid duplicates
        if (!waitingTiles.some(w => w.suit === suit && w.value === value)) {
          waitingTiles.push(testTile);
        }
      }
    }
  }

  return waitingTiles;
}
