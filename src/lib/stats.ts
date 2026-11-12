import { DeckType, ParticipantVote, VoteValue } from '../types.js';
import { DECK_PRESETS } from '../constants/avatars.js';

export interface DimensionStats {
  validVotes: ParticipantVote[];
  numericValues: number[];
  distribution: Record<string, number>;
  average: number | null;
  mode: VoteValue | null;
  maxCount: number;
  totalVotes: number;
  isUnanimous: boolean;
}

const NON_CONSENSUS_TOKENS = new Set(['?', '☕', '∞']);

export function getActiveDeckValues(deckType: DeckType = 'fibonacci', customValues?: VoteValue[]): VoteValue[] {
  if (deckType === 'custom' && Array.isArray(customValues) && customValues.length > 0) {
    return customValues;
  }
  return DECK_PRESETS[deckType]?.values || DECK_PRESETS.fibonacci.values;
}

export function findNearestDeckValue(
  target: number,
  deckType: DeckType = 'fibonacci',
  customValues?: VoteValue[]
): VoteValue {
  const cards = getActiveDeckValues(deckType, customValues);
  const numericCandidates: { card: VoteValue; numeric: number }[] = [];

  for (const c of cards) {
    if (typeof c === 'number' && !isNaN(c)) {
      numericCandidates.push({ card: c, numeric: c });
    } else if (typeof c === 'string' && !NON_CONSENSUS_TOKENS.has(c)) {
      const parsed = Number(c);
      if (!isNaN(parsed) && c.trim() !== '') {
        numericCandidates.push({ card: c, numeric: parsed });
      }
    }
  }

  if (numericCandidates.length === 0) {
    return Math.round(target * 10) / 10;
  }

  const nearest = numericCandidates.reduce((prev, curr) =>
    Math.abs(curr.numeric - target) < Math.abs(prev.numeric - target) ? curr : prev
  );
  return nearest.card;
}

export function calculateValueStats(
  votes: Record<string, ParticipantVote> | ParticipantVote[],
  valueExtractor: (p: ParticipantVote) => VoteValue | undefined
): DimensionStats {
  const list = Array.isArray(votes) ? votes : Object.values(votes || {});
  const validVotes: ParticipantVote[] = [];
  const numericValues: number[] = [];
  const distribution: Record<string, number> = {};
  const comparableValues: string[] = [];

  for (const p of list) {
    if (!p || p.isSpectator || !p.hasVoted) continue;
    const val = valueExtractor(p);
    if (val === undefined || val === null || val === '') continue;

    validVotes.push(p);
    const valStr = String(val);
    distribution[valStr] = (distribution[valStr] || 0) + 1;

    if (!NON_CONSENSUS_TOKENS.has(valStr)) {
      comparableValues.push(valStr);
      if (typeof val === 'number' && !isNaN(val)) {
        numericValues.push(val);
      } else if (typeof val === 'string') {
        const parsed = Number(val);
        if (!isNaN(parsed) && val.trim() !== '') {
          numericValues.push(parsed);
        }
      }
    }
  }

  const totalVotes = validVotes.length;

  let average: number | null = null;
  if (numericValues.length > 0) {
    const sum = numericValues.reduce((acc, curr) => acc + curr, 0);
    average = Math.round((sum / numericValues.length) * 10) / 10;
  }

  let mode: VoteValue | null = null;
  let maxCount = 0;
  let topValues: string[] = [];

  for (const [valStr, count] of Object.entries(distribution)) {
    if (count > maxCount) {
      maxCount = count;
      topValues = [valStr];
    } else if (count === maxCount) {
      topValues.push(valStr);
    }
  }

  if (topValues.length === 1 && (totalVotes === 1 || maxCount > 1)) {
    const valStr = topValues[0];
    const matchingVote = validVotes.find(p => String(valueExtractor(p)) === valStr);
    const originalVal = matchingVote ? valueExtractor(matchingVote) : undefined;
    if (typeof originalVal === 'number') {
      mode = originalVal;
    } else {
      const parsedNum = Number(valStr);
      if (!isNaN(parsedNum) && !NON_CONSENSUS_TOKENS.has(valStr) && String(parsedNum) === valStr) {
        mode = parsedNum;
      } else {
        mode = valStr;
      }
    }
  }

  const isUnanimous =
    comparableValues.length > 0 &&
    comparableValues.length === totalVotes &&
    comparableValues.every(v => v === comparableValues[0]);

  return {
    validVotes,
    numericValues,
    distribution,
    average,
    mode,
    maxCount,
    totalVotes,
    isUnanimous
  };
}
