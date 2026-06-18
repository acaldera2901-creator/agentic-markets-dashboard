import { describe, it, expect } from 'vitest';
import { settledPickToCardData, unifiedRowToSettledPick } from '../../src/data/pick-adapter.ts';
import type { SettledPick, UnifiedSettledRow } from '../../src/data/pick-adapter.ts';

// ---- fixtures ----

const footballWon: SettledPick = {
  sport: 'football',
  home_team: 'Norrköping',
  away_team: 'Häcken',
  final_score: '2-1',
  pick: 'HOME',
  confidence: 0.63,
  result: 'won',
};

const tennisLost: SettledPick = {
  sport: 'tennis',
  home_team: 'Sinner',
  away_team: 'Alcaraz',
  final_score: '6-4 6-3',
  pick: 'Alcaraz',
  confidence: 0.55,
  result: 'lost',
};

// ---- unified row fixtures ----

const unifiedFootball: UnifiedSettledRow = {
  sport: 'football',
  home_team: 'Inter',
  away_team: 'Milan',
  player_one: null,
  player_two: null,
  pick: 'home',
  confidence_score: 63,
  result: 'won',
  notes: '{"final_score":"2-1"}',
};

const unifiedTennis: UnifiedSettledRow = {
  sport: 'tennis',
  home_team: null,
  away_team: null,
  player_one: 'Sinner',
  player_two: 'Alcaraz',
  pick: 'Sinner',
  confidence_score: 55,
  result: 'lost',
  notes: { final_score: '6-4 6-3' },
};

// ---- tests for unifiedRowToSettledPick ----

describe('unifiedRowToSettledPick', () => {
  it('maps football row (notes as JSON string) correctly', () => {
    const pick = unifiedRowToSettledPick(unifiedFootball);
    expect(pick.home_team).toBe('Inter');
    expect(pick.away_team).toBe('Milan');
    expect(pick.final_score).toBe('2-1');
    expect(pick.confidence).toBeCloseTo(0.63);
    expect(pick.pick).toBe('home');
    expect(pick.result).toBe('won');
  });

  it('maps football row through settledPickToCardData end-to-end', () => {
    const pick = unifiedRowToSettledPick(unifiedFootball);
    const card = settledPickToCardData(pick);
    expect(card.pick).toBe('1 (vittoria casa)');
    expect(card.probability).toBeCloseTo(0.63);
    expect(card.score).toBe('2-1');
    expect(card.outcome).toBe('won');
  });

  it('maps tennis row (notes as object) correctly', () => {
    const pick = unifiedRowToSettledPick(unifiedTennis);
    expect(pick.home_team).toBe('Sinner');
    expect(pick.away_team).toBe('Alcaraz');
    expect(pick.final_score).toBe('6-4 6-3');
    expect(pick.confidence).toBeCloseTo(0.55);
  });

  it('keeps confidence in 0..1 when confidence_score is already ≤ 1', () => {
    const row: UnifiedSettledRow = { ...unifiedFootball, confidence_score: 0.7 };
    const pick = unifiedRowToSettledPick(row);
    expect(pick.confidence).toBeCloseTo(0.7);
  });

  it('returns null final_score when notes has no final_score key', () => {
    const row: UnifiedSettledRow = { ...unifiedFootball, notes: '{"foo":1}' };
    const pick = unifiedRowToSettledPick(row);
    expect(pick.final_score).toBeNull();
  });

  it('returns null final_score when notes is null', () => {
    const row: UnifiedSettledRow = { ...unifiedFootball, notes: null };
    const pick = unifiedRowToSettledPick(row);
    expect(pick.final_score).toBeNull();
  });

  it('throws when notes lacks final_score and fed to settledPickToCardData', () => {
    const row: UnifiedSettledRow = { ...unifiedFootball, notes: null };
    const pick = unifiedRowToSettledPick(row);
    expect(() => settledPickToCardData(pick)).toThrow();
  });
});

// ---- tests ----

describe('settledPickToCardData', () => {
  it('maps a football won row correctly', () => {
    const card = settledPickToCardData(footballWon);
    expect(card.sport).toBe('football');
    expect(card.home).toBe('Norrköping');
    expect(card.away).toBe('Häcken');
    expect(card.score).toBe('2-1');
    expect(card.pick).toBe('1 (vittoria casa)');
    expect(card.probability).toBeCloseTo(0.63);
    expect(card.outcome).toBe('won');
  });

  it('maps a tennis lost row correctly (pick passthrough)', () => {
    const card = settledPickToCardData(tennisLost);
    expect(card.sport).toBe('tennis');
    expect(card.home).toBe('Sinner');
    expect(card.away).toBe('Alcaraz');
    expect(card.score).toBe('6-4 6-3');
    expect(card.pick).toBe('Alcaraz');
    expect(card.probability).toBeCloseTo(0.55);
    expect(card.outcome).toBe('lost');
  });

  it('throws for result "void" (non-renderable)', () => {
    const row: SettledPick = { ...footballWon, result: 'void' };
    expect(() => settledPickToCardData(row)).toThrow();
  });

  it('throws for result "unresolved" (non-renderable)', () => {
    const row: SettledPick = { ...footballWon, result: 'unresolved' };
    expect(() => settledPickToCardData(row)).toThrow();
  });

  it('throws when pick is null', () => {
    const row: SettledPick = { ...footballWon, pick: null };
    expect(() => settledPickToCardData(row)).toThrow();
  });

  it('throws when final_score is null', () => {
    const row: SettledPick = { ...footballWon, final_score: null };
    expect(() => settledPickToCardData(row)).toThrow();
  });
});
