import { describe, it, expect } from 'vitest';
import { settledPickToCardData } from '../../src/data/pick-adapter.ts';
import type { SettledPick } from '../../src/data/pick-adapter.ts';

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
