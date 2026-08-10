import type { EventCard, MemoryCriticality } from './types.js';

const BASE_DECAY = 0.15;
const REHEARSAL_FACTOR = 1.5;

export function criticalityFloor(criticality: MemoryCriticality): number {
  if (criticality === 'safety') return 1;
  if (criticality === 'identity') return 0.9;
  if (criticality === 'preference') return 0.3;
  return 0;
}

export function memoryWeightAt(event: EventCard, currentTurn: number): number {
  if (event.status === 'forgotten' || event.status === 'archived') return 0;
  const elapsed = Math.max(0, currentTurn - event.weight.lastAdoptedTurn);
  const mentionCount = Math.max(1, event.weight.mentionCount);
  const lambda = BASE_DECAY / (1 + REHEARSAL_FACTOR * Math.log(mentionCount));
  const decayed = Math.max(event.weight.floorWeight, Math.exp(-lambda * elapsed));
  const capped = event.weight.forcedCap === null ? decayed : Math.min(decayed, event.weight.forcedCap);
  return event.weight.pinned ? 1 : capped;
}
