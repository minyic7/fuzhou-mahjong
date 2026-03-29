import type { TileInstance } from '../types/tile.js';
import type { PlayerState } from '../types/player.js';
import { MeldType } from '../types/meld.js';

const BASE_RETENTION = 18;
const FINAL_DRAWS_COUNT = 4;

/**
 * Count flower gangs (花杠) from a player's flower collection.
 * - 4 identical wind tiles (e.g. 4x East) = 1 flower gang
 * - 4 identical dragon tiles (e.g. 4x Red) = 1 flower gang
 * - Complete season set (春夏秋冬) = 1 flower gang
 * - Complete plant set (梅兰竹菊) = 1 flower gang
 */
export function countFlowerGangs(flowers: TileInstance[]): number {
  let count = 0;

  // Count by sub-type
  const groups = new Map<string, number>();
  const seasons = new Set<string>();
  const plants = new Set<string>();

  for (const f of flowers) {
    const tile = f.tile;
    switch (tile.kind) {
      case 'wind': {
        const key = `wind-${tile.windType}`;
        groups.set(key, (groups.get(key) ?? 0) + 1);
        break;
      }
      case 'dragon': {
        const key = `dragon-${tile.dragonType}`;
        groups.set(key, (groups.get(key) ?? 0) + 1);
        break;
      }
      case 'season':
        seasons.add(tile.seasonType);
        break;
      case 'plant':
        plants.add(tile.plantType);
        break;
    }
  }

  // 4 identical wind/dragon tiles = flower gang
  for (const c of groups.values()) {
    if (c >= 4) count++;
  }

  // Complete season set = flower gang
  if (seasons.size === 4) count++;

  // Complete plant set = flower gang
  if (plants.size === 4) count++;

  return count;
}

/**
 * Calculate total retain count (tiles that must remain undrawn).
 * Base: 18
 * + Ming Gang × 1 (across all players)
 * + An Gang × 2 (across all players)
 * + Bu Gang × 1 (treated as ming gang for retention)
 * + Flower Gang × 2 (across all players)
 */
export function calculateRetainCount(players: PlayerState[]): number {
  let retain = BASE_RETENTION;

  for (const player of players) {
    // Count gangs from melds
    for (const meld of player.melds) {
      switch (meld.type) {
        case MeldType.MingGang:
        case MeldType.BuGang:
          retain += 1;
          break;
        case MeldType.AnGang:
          retain += 2;
          break;
      }
    }

    // Count flower gangs
    retain += countFlowerGangs(player.flowers) * 2;
  }

  return retain;
}

/**
 * Check if the game should end as a draw (流局/荒牌).
 * A draw occurs when total remaining tiles <= retain count.
 */
export function isDraw(
  wallLength: number,
  wallTailLength: number,
  retainCount: number,
): boolean {
  return wallLength + wallTailLength <= retainCount;
}

/**
 * Check if we are in the final draws phase.
 * Final draws = last 4 drawable tiles before the retention limit.
 * During final draws: no flower replacement, no discarding — only self-draw win attempts.
 */
export function isInFinalDraws(
  wallLength: number,
  wallTailLength: number,
  retainCount: number,
): boolean {
  const drawable = wallLength + wallTailLength - retainCount;
  return drawable > 0 && drawable <= FINAL_DRAWS_COUNT;
}
