import { isSuitedTile } from '../types/tile.js';
import type { TileInstance, SuitedTile } from '../types/tile.js';
import type { GoldState } from '../types/game.js';
import type { Meld } from '../types/meld.js';
import { MeldType } from '../types/meld.js';
import { isGoldTile } from './gold.js';

/** Check if two suited tiles have the same suit and value */
export function suitedTilesMatch(a: SuitedTile, b: SuitedTile): boolean {
  return a.suit === b.suit && a.value === b.value;
}

/** Filter hand to non-gold suited tiles */
function getNonGoldSuitedTiles(
  hand: TileInstance[],
  gold: GoldState | null,
): TileInstance[] {
  return hand.filter(t => {
    if (!isSuitedTile(t.tile)) return false;
    if (gold && isGoldTile(t, gold)) return false;
    return true;
  });
}

/**
 * Find all chi (sequence) combinations for a discard tile.
 * Returns array of [tile1, tile2] pairs from hand that form a sequence with the discard.
 */
export function findChiCombinations(
  hand: TileInstance[],
  discardTile: TileInstance,
  gold: GoldState | null,
): [TileInstance, TileInstance][] {
  if (!isSuitedTile(discardTile.tile)) return [];
  if (gold && isGoldTile(discardTile, gold)) return [];

  const discardValue = discardTile.tile.value;
  const discardSuit = discardTile.tile.suit;

  const sameSuit = getNonGoldSuitedTiles(hand, gold).filter(
    t => (t.tile as SuitedTile).suit === discardSuit,
  );

  const results: [TileInstance, TileInstance][] = [];

  // Three possible sequence positions for the discard:
  // discard is LOW:  [discard, discard+1, discard+2]
  // discard is MID:  [discard-1, discard, discard+1]
  // discard is HIGH: [discard-2, discard-1, discard]
  const offsets: [number, number][] = [
    [1, 2],   // need discard+1 and discard+2
    [-1, 1],  // need discard-1 and discard+1
    [-2, -1], // need discard-2 and discard-1
  ];

  for (const [o1, o2] of offsets) {
    const v1 = discardValue + o1;
    const v2 = discardValue + o2;
    if (v1 < 1 || v1 > 9 || v2 < 1 || v2 > 9) continue;

    const matches1 = sameSuit.filter(t => (t.tile as SuitedTile).value === v1);
    const matches2 = sameSuit.filter(t => (t.tile as SuitedTile).value === v2);

    for (const t1 of matches1) {
      for (const t2 of matches2) {
        if (t1.id !== t2.id) {
          results.push([t1, t2]);
        }
      }
    }
  }

  return results;
}

/** Check if peng is possible (2 matching tiles in hand) */
export function canPeng(
  hand: TileInstance[],
  discardTile: TileInstance,
  gold: GoldState | null,
): boolean {
  if (!isSuitedTile(discardTile.tile)) return false;
  if (gold && isGoldTile(discardTile, gold)) return false;

  const matching = getNonGoldSuitedTiles(hand, gold).filter(t =>
    suitedTilesMatch(t.tile as SuitedTile, discardTile.tile as SuitedTile),
  );
  return matching.length >= 2;
}

/** Check if ming gang is possible (3 matching tiles in hand + discard) */
export function canMingGang(
  hand: TileInstance[],
  discardTile: TileInstance,
  gold: GoldState | null,
): boolean {
  if (!isSuitedTile(discardTile.tile)) return false;
  if (gold && isGoldTile(discardTile, gold)) return false;

  const matching = getNonGoldSuitedTiles(hand, gold).filter(t =>
    suitedTilesMatch(t.tile as SuitedTile, discardTile.tile as SuitedTile),
  );
  return matching.length >= 3;
}

/** Find all an gang (4 identical tiles in hand) */
export function findAnGang(
  hand: TileInstance[],
  gold: GoldState | null,
): TileInstance[][] {
  const nonGold = getNonGoldSuitedTiles(hand, gold);
  const groups = new Map<string, TileInstance[]>();

  for (const t of nonGold) {
    const suited = t.tile as SuitedTile;
    const key = `${suited.suit}-${suited.value}`;
    const group = groups.get(key) ?? [];
    group.push(t);
    groups.set(key, group);
  }

  const results: TileInstance[][] = [];
  for (const group of groups.values()) {
    if (group.length === 4) {
      results.push(group);
    }
  }
  return results;
}

/** Find all bu gang (supplement an existing peng with 4th tile from hand) */
export function findBuGang(
  hand: TileInstance[],
  melds: Meld[],
  gold: GoldState | null,
): { tile: TileInstance; meldIndex: number }[] {
  const results: { tile: TileInstance; meldIndex: number }[] = [];
  const nonGold = getNonGoldSuitedTiles(hand, gold);

  for (let i = 0; i < melds.length; i++) {
    if (melds[i].type !== MeldType.Peng) continue;

    const pengTile = melds[i].tiles[0];
    if (!isSuitedTile(pengTile.tile)) continue;

    const match = nonGold.find(t =>
      suitedTilesMatch(t.tile as SuitedTile, pengTile.tile as SuitedTile),
    );
    if (match) {
      results.push({ tile: match, meldIndex: i });
    }
  }

  return results;
}
