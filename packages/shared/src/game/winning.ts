import { isSuitedTile } from '../types/tile.js';
import type { TileInstance, SuitedTile } from '../types/tile.js';
import type { GoldState } from '../types/game.js';
import type { PlayerState } from '../types/player.js';
import { MeldType } from '../types/meld.js';
import type { Meld } from '../types/meld.js';
import { isGoldTile } from './gold.js';

// ─── Types ───────────────────────────────────────────────────────

export enum WinType {
  None = 'none',
  Normal = 'normal',
  TianHu = 'tianHu',
  GrabGold = 'grabGold',
  PingHu0 = 'pingHu0',
  PingHu1 = 'pingHu1',
  ThreeGoldDown = 'threeGoldDown',
  GoldSparrow = 'goldSparrow',
  GoldDragon = 'goldDragon',
  DuiDuiHu = 'duiDuiHu',
  QingYiSe = 'qingYiSe',
}

export interface WinResult {
  isWin: boolean;
  winType: WinType;
  multiplier: number;
}

export interface WinContext {
  isSelfDraw: boolean;
  isFirstAction: boolean;
  isDealer: boolean;
  isRobbingKong: boolean;
  totalFlowers: number;
  totalGangs: number;
}

// ─── Core hand pattern validation ────────────────────────────────

/**
 * Check if sorted values (single suit) + golds can form exactly setsNeeded sets.
 * Each set = triplet (3 same) or sequence (3 consecutive).
 */
function canFormSetsForSuit(values: number[], golds: number, setsNeeded: number): boolean {
  if (setsNeeded === 0) return values.length === 0;
  if (values.length === 0) return golds >= setsNeeded * 3;
  if (values.length + golds < setsNeeded * 3) return false;

  const first = values[0];

  // Try triplet from first value
  const sameCount = values.filter(v => v === first).length;
  for (let fromHand = Math.min(3, sameCount); fromHand >= 1; fromHand--) {
    const goldsUsed = 3 - fromHand;
    if (goldsUsed <= golds) {
      const rest = values.slice();
      for (let i = 0; i < fromHand; i++) rest.splice(rest.indexOf(first), 1);
      if (canFormSetsForSuit(rest, golds - goldsUsed, setsNeeded - 1)) return true;
    }
  }

  // Try sequence starting from first value
  if (first <= 7) {
    const seq = [first, first + 1, first + 2];
    let goldsUsed = 0;
    const rest = values.slice();
    let valid = true;
    for (const v of seq) {
      const idx = rest.indexOf(v);
      if (idx >= 0) rest.splice(idx, 1);
      else { goldsUsed++; if (goldsUsed > golds) { valid = false; break; } }
    }
    if (valid && canFormSetsForSuit(rest, golds - goldsUsed, setsNeeded - 1)) return true;
  }

  return false;
}

/**
 * Distribute gold wildcards across suit groups to form sets.
 * Returns true if all tiles can be arranged into exactly setsNeeded sets.
 */
function canDistributeSets(
  suitGroups: number[][],
  idx: number,
  golds: number,
  setsNeeded: number,
): boolean {
  if (setsNeeded === 0) {
    for (let i = idx; i < suitGroups.length; i++) {
      if (suitGroups[i].length > 0) return false;
    }
    return true;
  }
  if (idx >= suitGroups.length) return golds >= setsNeeded * 3;

  const group = suitGroups[idx];
  if (group.length === 0) return canDistributeSets(suitGroups, idx + 1, golds, setsNeeded);

  // Try allocating 1..setsNeeded sets to this suit group
  const maxSets = Math.min(setsNeeded, Math.ceil((group.length + golds) / 3));
  for (let n = maxSets; n >= 1; n--) {
    // Try forming exactly n sets from this group, using up to `golds` wildcards
    // We try all possible gold allocations for this group
    const minGoldsForGroup = Math.max(0, n * 3 - group.length);
    const maxGoldsForGroup = Math.min(golds, n * 3);
    for (let g = minGoldsForGroup; g <= maxGoldsForGroup; g++) {
      if (canFormSetsForSuit(group, g, n)) {
        if (canDistributeSets(suitGroups, idx + 1, golds - g, setsNeeded - n)) return true;
      }
    }
  }

  // Try allocating 0 sets to this group (all tiles here use golds? No - tiles must be used)
  // If group has tiles, they must be part of some set, so 0 sets only works if group is empty
  return false;
}

/**
 * Check if suited tiles + golds form N sets (no pair).
 */
function canFormSets(suitedTiles: SuitedTile[], golds: number, setsNeeded: number): boolean {
  const bySuit = new Map<string, number[]>();
  for (const t of suitedTiles) {
    const arr = bySuit.get(t.suit) ?? [];
    arr.push(t.value);
    bySuit.set(t.suit, arr);
  }
  for (const arr of bySuit.values()) arr.sort((a, b) => a - b);

  return canDistributeSets(Array.from(bySuit.values()), 0, golds, setsNeeded);
}

/**
 * Check if suited tiles + golds form 1 pair + setsNeeded sets.
 */
export function isValidHand(
  handTiles: SuitedTile[],
  goldCount: number,
  setsNeeded: number = 5,
): boolean {
  // Find unique tile types for pair candidates
  const seen = new Set<string>();
  const candidates: { suit: string; value: number; count: number }[] = [];
  for (const t of handTiles) {
    const key = `${t.suit}-${t.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push({ suit: t.suit, value: t.value, count: 0 });
    }
    candidates[candidates.length - 1].count++;
  }

  // Fix count tracking
  const countMap = new Map<string, number>();
  for (const t of handTiles) {
    const key = `${t.suit}-${t.value}`;
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }

  // Try pair from 2 identical tiles
  for (const [key, count] of countMap) {
    if (count >= 2) {
      const remaining = handTiles.slice();
      let removed = 0;
      const [suit, valStr] = key.split('-');
      const value = Number(valStr);
      for (let i = remaining.length - 1; i >= 0 && removed < 2; i--) {
        if (remaining[i].suit === suit && remaining[i].value === value) {
          remaining.splice(i, 1);
          removed++;
        }
      }
      if (canFormSets(remaining, goldCount, setsNeeded)) return true;
    }
  }

  // Try pair with 1 tile + 1 gold
  if (goldCount >= 1) {
    const tried = new Set<string>();
    for (const t of handTiles) {
      const key = `${t.suit}-${t.value}`;
      if (tried.has(key)) continue;
      tried.add(key);
      const remaining = handTiles.slice();
      const idx = remaining.findIndex(r => r.suit === t.suit && r.value === t.value);
      remaining.splice(idx, 1);
      if (canFormSets(remaining, goldCount - 1, setsNeeded)) return true;
    }
  }

  // Try pair with 2 golds
  if (goldCount >= 2) {
    if (canFormSets(handTiles, goldCount - 2, setsNeeded)) return true;
  }

  return false;
}

// ─── Pattern detection ───────────────────────────────────────────

/**
 * Check if hand is all triplets (对对胡).
 * Gold tiles CANNOT be used as wilds in dui dui hu.
 */
export function isDuiDuiHu(handTiles: SuitedTile[], melds: Meld[]): boolean {
  for (const m of melds) {
    if (m.type === MeldType.Chi) return false;
  }

  const groups = new Map<string, number>();
  for (const t of handTiles) {
    const key = `${t.suit}-${t.value}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }

  let pairs = 0;
  for (const count of groups.values()) {
    if (count === 2) pairs++;
    else if (count === 3) { /* triplet */ }
    else return false;
  }
  return pairs === 1;
}

/**
 * Check if all tiles are from one suit (清一色).
 */
export function isQingYiSe(handTiles: SuitedTile[], melds: Meld[]): boolean {
  if (handTiles.length === 0) return false;
  const suit = handTiles[0].suit;
  if (!handTiles.every(t => t.suit === suit)) return false;
  for (const m of melds) {
    for (const ti of m.tiles) {
      if (!isSuitedTile(ti.tile) || ti.tile.suit !== suit) return false;
    }
  }
  return true;
}

// ─── Main win check ──────────────────────────────────────────────

/**
 * Evaluate player's hand + winning tile for all win conditions.
 * Returns the highest applicable win type.
 */
export function checkWin(
  player: PlayerState,
  winningTile: TileInstance,
  gold: GoldState | null,
  context: WinContext,
): WinResult {
  const noWin: WinResult = { isWin: false, winType: WinType.None, multiplier: 0 };

  if (!isSuitedTile(winningTile.tile)) return noWin;

  // Collect all hand tiles including winning tile
  const allHandTiles = [...player.hand, winningTile];

  // Separate gold and non-gold suited tiles
  const suitedInstances: TileInstance[] = [];
  let goldCount = 0;

  for (const ti of allHandTiles) {
    if (!isSuitedTile(ti.tile)) continue;
    if (gold && isGoldTile(ti, gold)) {
      goldCount++;
    } else {
      suitedInstances.push(ti);
    }
  }

  const suitedTiles = suitedInstances.map(ti => ti.tile as SuitedTile);
  const setsNeeded = 5 - player.melds.length;

  // ─── Special wins (highest multiplier first) ───

  // Gold Dragon (金龙) 120x: 3 golds as triplet of own type, rest valid hand
  if (goldCount === 3 && setsNeeded >= 1) {
    if (isValidHand(suitedTiles, 0, setsNeeded - 1)) {
      return { isWin: true, winType: WinType.GoldDragon, multiplier: 120 };
    }
  }

  // Gold Sparrow (金雀) 60x: 2 golds as pair, rest forms sets
  if (goldCount >= 2) {
    if (canFormSets(suitedTiles, goldCount - 2, setsNeeded)) {
      return { isWin: true, winType: WinType.GoldSparrow, multiplier: 60 };
    }
  }

  // Three Gold Down (三金倒) 40x: all 3 golds = instant win
  if (goldCount === 3) {
    return { isWin: true, winType: WinType.ThreeGoldDown, multiplier: 40 };
  }

  // Check basic hand validity for remaining win types
  const hasValidHand = isValidHand(suitedTiles, goldCount, setsNeeded);
  if (!hasValidHand) return noWin;

  // Tian Hu (天胡) 30x
  if (context.isFirstAction && context.isDealer && context.isSelfDraw) {
    return { isWin: true, winType: WinType.TianHu, multiplier: 30 };
  }

  // Grab Gold (抢金) 30x
  if (context.isFirstAction && gold && isGoldTile(winningTile, gold)) {
    return { isWin: true, winType: WinType.GrabGold, multiplier: 30 };
  }

  // Ping Hu 0 flowers 30x
  if (context.totalFlowers === 0 && context.totalGangs === 0) {
    return { isWin: true, winType: WinType.PingHu0, multiplier: 30 };
  }

  // Ping Hu 1 flower 15x
  if (context.totalFlowers === 1 && context.totalGangs === 0) {
    return { isWin: true, winType: WinType.PingHu1, multiplier: 15 };
  }

  // Dui Dui Hu (no extra multiplier)
  if (isDuiDuiHu(suitedTiles, player.melds)) {
    return { isWin: true, winType: WinType.DuiDuiHu, multiplier: 0 };
  }

  // Qing Yi Se (no extra multiplier)
  if (isQingYiSe(suitedTiles, player.melds)) {
    return { isWin: true, winType: WinType.QingYiSe, multiplier: 0 };
  }

  // Normal win
  return { isWin: true, winType: WinType.Normal, multiplier: 0 };
}
