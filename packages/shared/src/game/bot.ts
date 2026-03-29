import { isSuitedTile } from '../types/tile.js';
import type { TileInstance, SuitedTile } from '../types/tile.js';
import type { GoldState } from '../types/game.js';
import type { AvailableActions } from '../types/events.js';
import type { Meld } from '../types/meld.js';
import type { GameAction } from '../types/action.js';
import { ActionType } from '../types/action.js';
import { isGoldTile } from './gold.js';

/**
 * Bot AI: decide what action to take given available options.
 * Simple heuristic strategy:
 * 1. Always hu if possible
 * 2. Always gang if possible (more points)
 * 3. Peng if it completes a triplet
 * 4. Chi if it helps form sequences
 * 5. Discard least useful tile
 * 6. Pass otherwise
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

  // Priority 3: Gang (more flower points)
  if (actions.canMingGang && lastDiscardTile) {
    return { type: ActionType.MingGang, playerIndex, targetTile: lastDiscardTile };
  }
  if (actions.anGangOptions.length > 0) {
    return { type: ActionType.AnGang, playerIndex, tile: actions.anGangOptions[0][0] };
  }
  if (actions.buGangOptions.length > 0) {
    return { type: ActionType.BuGang, playerIndex, tile: actions.buGangOptions[0].tile };
  }

  // Priority 4: Peng
  if (actions.canPeng && lastDiscardTile) {
    return { type: ActionType.Peng, playerIndex, targetTile: lastDiscardTile };
  }

  // Priority 5: Chi (take first option)
  if (actions.chiOptions.length > 0 && lastDiscardTile) {
    return {
      type: ActionType.Chi,
      playerIndex,
      tiles: actions.chiOptions[0] as [TileInstance, TileInstance],
      targetTile: lastDiscardTile,
    };
  }

  // Priority 6: Discard
  if (actions.canDiscard) {
    const tile = chooseBotDiscard(hand, gold);
    return { type: ActionType.Discard, playerIndex, tile };
  }

  // Default: pass
  return { type: ActionType.Pass, playerIndex };
}

/**
 * Choose which tile to discard.
 * Strategy: discard the most isolated tile (fewest neighbors in same suit).
 * Never discard gold tiles.
 */
function chooseBotDiscard(hand: TileInstance[], gold: GoldState | null): TileInstance {
  if (hand.length === 0) throw new Error("Bot has no tiles to discard");
  if (hand.length === 1) return hand[0];

  let bestTile = hand[0];
  let bestScore = Infinity;

  for (const tile of hand) {
    // Never discard gold
    if (gold && isGoldTile(tile, gold)) continue;

    const score = tileUsefulness(tile, hand, gold);
    if (score < bestScore) {
      bestScore = score;
      bestTile = tile;
    }
  }

  return bestTile;
}

/**
 * Score how useful a tile is (higher = more useful, keep it).
 * Considers: pairs, neighbors for sequences, gold status.
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

  for (const other of hand) {
    if (other.id === tile.id) continue;
    if (!isSuitedTile(other.tile)) continue;
    const otherSuited = other.tile as SuitedTile;

    if (otherSuited.suit !== suited.suit) continue;

    const diff = Math.abs(otherSuited.value - suited.value);
    if (diff === 0) score += 5;      // Pair/triplet
    else if (diff === 1) score += 3;  // Adjacent (sequence potential)
    else if (diff === 2) score += 1;  // Gap sequence potential
  }

  // Middle values (4-6) are more versatile
  if (suited.value >= 3 && suited.value <= 7) score += 1;

  return score;
}
