import { isSuitedTile, Suit } from '../types/tile.js';
import type { TileInstance, SuitedTile } from '../types/tile.js';
import type { GoldState } from '../types/game.js';
import type { AvailableActions } from '../types/events.js';
import type { Meld } from '../types/meld.js';
import { MeldType } from '../types/meld.js';
import type { GameAction } from '../types/action.js';
import { ActionType } from '../types/action.js';
import { isGoldTile } from './gold.js';
import { findTenpaiTiles } from './hand.js';
import { isValidHand } from './winning.js';

// ─── Shanten estimation ──────────────────────────────────────────

/**
 * Extract non-gold suited tiles and gold count from hand.
 */
function extractHandInfo(
  hand: TileInstance[],
  gold: GoldState | null,
): { suitedTiles: SuitedTile[]; goldCount: number } {
  const suitedTiles: SuitedTile[] = [];
  let goldCount = 0;
  for (const t of hand) {
    if (!isSuitedTile(t.tile)) continue;
    if (gold && isGoldTile(t, gold)) { goldCount++; continue; }
    suitedTiles.push(t.tile);
  }
  return { suitedTiles, goldCount };
}

/**
 * Estimate shanten (tiles away from tenpai).
 * Returns 0 if tenpai, 1 if one-away, 2+ as rough heuristic.
 */
function estimateShanten(
  hand: TileInstance[],
  melds: Meld[],
  gold: GoldState | null,
): number {
  // Check tenpai (shanten = 0)
  const tenpai = findTenpaiTiles(hand, melds, gold);
  if (tenpai.length > 0) return 0;

  const { suitedTiles, goldCount } = extractHandInfo(hand, gold);
  const setsNeeded = 5 - melds.length;

  // Check shanten = 1: try removing each tile, see if resulting hand is tenpai
  // For performance, limit: only check unique tile types
  const checkedKeys = new Set<string>();
  for (let i = 0; i < suitedTiles.length; i++) {
    const t = suitedTiles[i];
    const key = `${t.suit}-${t.value}`;
    if (checkedKeys.has(key)) continue;
    checkedKeys.add(key);

    const remaining = suitedTiles.slice();
    remaining.splice(i, 1);

    // Try adding each possible tile and check for valid hand
    for (const suit of [Suit.Wan, Suit.Bing, Suit.Tiao]) {
      for (let v = 1; v <= 9; v++) {
        const testTile: SuitedTile = { kind: 'suited', suit, value: v as SuitedTile['value'] };
        const testHand = [...remaining, testTile];
        if (isValidHand(testHand, goldCount, setsNeeded)) {
          return 1;
        }
      }
    }
  }

  // Rough heuristic for deeper shanten
  return estimateShantenHeuristic(suitedTiles, goldCount, setsNeeded);
}

/**
 * Rough shanten heuristic: count useful groups (pairs, partial sequences).
 */
function estimateShantenHeuristic(
  suitedTiles: SuitedTile[],
  goldCount: number,
  setsNeeded: number,
): number {
  // Group by suit
  const bySuit = new Map<string, number[]>();
  for (const t of suitedTiles) {
    const arr = bySuit.get(t.suit) ?? [];
    arr.push(t.value);
    bySuit.set(t.suit, arr);
  }
  for (const arr of bySuit.values()) arr.sort((a, b) => a - b);

  let pairs = 0;
  let partialSets = 0; // adjacent or gap pairs
  const used = new Set<number>();

  for (const values of bySuit.values()) {
    for (let i = 0; i < values.length; i++) {
      if (used.has(i)) continue;
      // Try triplet
      let count = 0;
      const indices: number[] = [];
      for (let j = i; j < values.length; j++) {
        if (values[j] === values[i] && !used.has(j)) {
          indices.push(j);
          count++;
        }
      }
      if (count >= 3) {
        used.add(indices[0]);
        used.add(indices[1]);
        used.add(indices[2]);
        partialSets++;
        continue;
      }
      // Try sequence
      let foundSeq = false;
      for (let j = i + 1; j < values.length && !foundSeq; j++) {
        if (used.has(j)) continue;
        if (values[j] === values[i] + 1) {
          for (let k = j + 1; k < values.length; k++) {
            if (used.has(k)) continue;
            if (values[k] === values[i] + 2) {
              used.add(i);
              used.add(j);
              used.add(k);
              partialSets++;
              foundSeq = true;
              break;
            }
          }
        }
      }
      if (foundSeq) continue;
      // Try pair
      if (count >= 2) {
        used.add(indices[0]);
        used.add(indices[1]);
        pairs++;
        continue;
      }
      // Try adjacent pair (partial sequence)
      for (let j = i + 1; j < values.length; j++) {
        if (used.has(j)) continue;
        const diff = values[j] - values[i];
        if (diff <= 2) {
          used.add(i);
          used.add(j);
          pairs++;
          break;
        }
      }
    }
  }

  // Estimate: we need setsNeeded sets + 1 pair
  // Each complete set removes 1 from shanten, each partial group removes 0.5
  const totalNeeded = setsNeeded + 1;
  const have = partialSets + pairs * 0.5 + goldCount * 0.5;
  return Math.max(2, Math.ceil(totalNeeded - have));
}

// ─── Hand quality evaluation ─────────────────────────────────────

/**
 * Evaluate overall hand quality (higher = better hand).
 * Sums tileUsefulness for all tiles.
 */
function handQuality(hand: TileInstance[], gold: GoldState | null): number {
  let total = 0;
  for (const tile of hand) {
    total += tileUsefulness(tile, hand, gold);
  }
  return total;
}

// ─── Tile usefulness scoring ─────────────────────────────────────

/**
 * Score how useful a tile is (higher = more useful, keep it).
 * Considers: pairs, neighbors for sequences, gold status, terminals.
 */
function tileUsefulness(
  tile: TileInstance,
  hand: TileInstance[],
  gold: GoldState | null,
): number {
  if (!isSuitedTile(tile.tile)) return 0;
  if (gold && isGoldTile(tile, gold)) return 100; // Never discard gold

  const suited = tile.tile as SuitedTile;
  let score = 0;

  let sameCount = 0;
  for (const other of hand) {
    if (other.id === tile.id) continue;
    if (!isSuitedTile(other.tile)) continue;
    if (gold && isGoldTile(other, gold)) continue;
    const otherSuited = other.tile as SuitedTile;

    if (otherSuited.suit !== suited.suit) continue;

    const diff = Math.abs(otherSuited.value - suited.value);
    if (diff === 0) {
      sameCount++;
      score += 5;      // Pair/triplet
    } else if (diff === 1) {
      score += 3;  // Adjacent (sequence potential)
    } else if (diff === 2) {
      score += 1;  // Gap sequence potential
    }
  }

  // Triplet bonus
  if (sameCount >= 2) score += 3;

  // Middle values (3-7) are more versatile for sequences
  if (suited.value >= 3 && suited.value <= 7) {
    score += 2;
  } else if (suited.value >= 2 && suited.value <= 8) {
    score += 1;
  }
  // Terminals (1, 9) get no bonus — they're harder to use in sequences

  return score;
}

// ─── Tenpai-aware discard ────────────────────────────────────────

/**
 * Score a discard candidate considering tenpai status.
 * Lower score = better discard candidate.
 */
function discardScore(
  tile: TileInstance,
  hand: TileInstance[],
  melds: Meld[],
  gold: GoldState | null,
  isTenpai: boolean,
): number {
  if (gold && isGoldTile(tile, gold)) return 1000; // Never discard gold

  let score = tileUsefulness(tile, hand, gold);

  if (isTenpai) {
    // Check if discarding this tile maintains tenpai
    const remaining = hand.filter(t => t.id !== tile.id);
    const tenpaiAfter = findTenpaiTiles(remaining, melds, gold);
    if (tenpaiAfter.length > 0) {
      // Maintains tenpai — prefer discarding this tile less (it's okay to discard)
      // but prefer discards that maintain more waiting tiles
      score -= 10; // Make it a better discard candidate since we stay tenpai
      score -= tenpaiAfter.length; // More waits = even better
    } else {
      // Breaks tenpai — strongly avoid discarding this tile
      score += 30;
    }
  }

  return score;
}

// ─── Bot discard logic ───────────────────────────────────────────

/**
 * Choose which tile to discard.
 * Strategy: tenpai-aware, discard least useful tile, never discard gold.
 */
function chooseBotDiscard(
  hand: TileInstance[],
  melds: Meld[],
  gold: GoldState | null,
): TileInstance {
  if (hand.length === 0) throw new Error("Bot has no tiles to discard");
  if (hand.length === 1) return hand[0];

  const tenpaiTiles = findTenpaiTiles(hand, melds, gold);
  const isTenpai = tenpaiTiles.length > 0;

  let bestTile = hand[0];
  let bestScore = Infinity;

  for (const tile of hand) {
    // Never discard gold
    if (gold && isGoldTile(tile, gold)) continue;

    const score = discardScore(tile, hand, melds, gold, isTenpai);
    if (score < bestScore) {
      bestScore = score;
      bestTile = tile;
    }
  }

  return bestTile;
}

// ─── Claim evaluation ────────────────────────────────────────────

/**
 * Evaluate whether claiming (peng/chi) improves the hand.
 * Returns true if the claim should be accepted.
 */
function shouldClaim(
  hand: TileInstance[],
  melds: Meld[],
  gold: GoldState | null,
  tilesToRemove: TileInstance[],
  newMeld: Meld,
): boolean {
  // Always claim if already tenpai (claiming may win or maintain tenpai)
  const currentTenpai = findTenpaiTiles(hand, melds, gold);
  if (currentTenpai.length > 0) {
    // Simulate the claim
    const remaining = hand.filter(t => !tilesToRemove.some(r => r.id === t.id));
    const newMelds = [...melds, newMeld];
    const newTenpai = findTenpaiTiles(remaining, newMelds, gold);
    // Accept if we reach or maintain tenpai
    return newTenpai.length > 0;
  }

  // Simulate the claim
  const remaining = hand.filter(t => !tilesToRemove.some(r => r.id === t.id));
  const newMelds = [...melds, newMeld];

  // Check if claim brings us to tenpai
  const newTenpai = findTenpaiTiles(remaining, newMelds, gold);
  if (newTenpai.length > 0) return true;

  // Compare shanten
  const currentShanten = estimateShanten(hand, melds, gold);
  const newShanten = estimateShanten(remaining, newMelds, gold);

  if (newShanten < currentShanten) return true;

  // If same shanten, compare hand quality
  if (newShanten === currentShanten) {
    const currentQuality = handQuality(hand, gold);
    const newQuality = handQuality(remaining, gold);
    // Only claim if quality clearly improves (accounts for losing flexibility from open meld)
    return newQuality > currentQuality + 3;
  }

  return false;
}

// ─── Chi selection ───────────────────────────────────────────────

/**
 * Evaluate chi options and return the best one, or null if none improves the hand.
 */
function evaluateChiOptions(
  hand: TileInstance[],
  melds: Meld[],
  gold: GoldState | null,
  chiOptions: TileInstance[][],
  targetTile: TileInstance,
): TileInstance[] | null {
  let bestOption: TileInstance[] | null = null;
  let bestScore = -Infinity;

  for (const option of chiOptions) {
    const tiles = option as [TileInstance, TileInstance];
    const newMeld: Meld = {
      type: MeldType.Chi,
      tiles: [...tiles, targetTile],
      sourceTile: targetTile,
    };

    // Check if this chi should be claimed at all
    if (!shouldClaim(hand, melds, gold, tiles, newMeld)) continue;

    // Score the remaining hand after this chi
    const remaining = hand.filter(t => !tiles.some(r => r.id === t.id));
    const newMelds = [...melds, newMeld];

    // Prefer options that reach tenpai
    const tenpai = findTenpaiTiles(remaining, newMelds, gold);
    let score = tenpai.length * 20;

    // Add hand quality
    score += handQuality(remaining, gold);

    if (score > bestScore) {
      bestScore = score;
      bestOption = option;
    }
  }

  return bestOption;
}

// ─── Main bot decision ───────────────────────────────────────────

/**
 * Bot AI: decide what action to take given available options.
 * Uses shanten estimation and tenpai detection for smarter decisions.
 */
export function decideBotAction(
  hand: TileInstance[],
  melds: Meld[],
  actions: AvailableActions,
  playerIndex: number,
  gold: GoldState | null,
  lastDiscardTile?: TileInstance,
): GameAction {
  // Priority 1: Always hu
  if (actions.canHu) {
    return { type: ActionType.Hu, playerIndex };
  }

  // Priority 2: Draw if available
  if (actions.canDraw) {
    return { type: ActionType.Draw, playerIndex };
  }

  // Priority 3: Gang (always accept — extra flowers are valuable)
  if (actions.canMingGang && lastDiscardTile) {
    return { type: ActionType.MingGang, playerIndex, targetTile: lastDiscardTile };
  }
  if (actions.anGangOptions.length > 0) {
    return { type: ActionType.AnGang, playerIndex, tile: actions.anGangOptions[0][0] };
  }
  if (actions.buGangOptions.length > 0) {
    return { type: ActionType.BuGang, playerIndex, tile: actions.buGangOptions[0].tile };
  }

  // Priority 4: Peng (evaluate whether it improves the hand)
  if (actions.canPeng && lastDiscardTile) {
    // Find the 2 matching tiles in hand
    const matchingTiles = hand.filter(t => {
      if (!isSuitedTile(t.tile) || !isSuitedTile(lastDiscardTile.tile)) return false;
      if (gold && isGoldTile(t, gold)) return false;
      const a = t.tile as SuitedTile;
      const b = lastDiscardTile.tile as SuitedTile;
      return a.suit === b.suit && a.value === b.value;
    }).slice(0, 2);

    if (matchingTiles.length >= 2) {
      const newMeld: Meld = {
        type: MeldType.Peng,
        tiles: [...matchingTiles, lastDiscardTile],
        sourceTile: lastDiscardTile,
      };

      if (shouldClaim(hand, melds, gold, matchingTiles, newMeld)) {
        return { type: ActionType.Peng, playerIndex, targetTile: lastDiscardTile };
      }
    }
  }

  // Priority 5: Chi (evaluate all options, pick best)
  if (actions.chiOptions.length > 0 && lastDiscardTile) {
    const bestChi = evaluateChiOptions(hand, melds, gold, actions.chiOptions, lastDiscardTile);
    if (bestChi) {
      return {
        type: ActionType.Chi,
        playerIndex,
        tiles: bestChi as [TileInstance, TileInstance],
        targetTile: lastDiscardTile,
      };
    }
  }

  // Priority 6: Discard
  if (actions.canDiscard) {
    const tile = chooseBotDiscard(hand, melds, gold);
    return { type: ActionType.Discard, playerIndex, tile };
  }

  // Default: pass
  return { type: ActionType.Pass, playerIndex };
}
