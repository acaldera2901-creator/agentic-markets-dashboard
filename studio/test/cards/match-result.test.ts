import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { renderMatchResultMarkup, renderCard } from '../../src/cards/match-result.ts';
import type { MatchResultCardData } from '../../src/cards/match-result.ts';
import { loadBrandKit } from '../../src/brandkit.ts';

const here = dirname(fileURLToPath(import.meta.url));
const KIT_PATH = resolve(here, '../../../../Maven-Brain/brandkits/betredge.json');
const FONTS_DIR = resolve(here, '../../assets/fonts');
const sample = JSON.parse(
  readFileSync(resolve(here, '../fixtures/sample-match.json'), 'utf8'),
) as MatchResultCardData;

describe('match-result card', () => {
  it('markup includes teams, score, pick, probability % and won/lost label', () => {
    const kit = loadBrandKit(KIT_PATH);
    const m = renderMatchResultMarkup(sample, kit);
    expect(m).toContain('Norrköping');
    expect(m).toContain('Häcken');
    expect(m).toContain('2-1');
    expect(m).toContain('63%');          // probabilità formattata
    expect(m).toContain('VINTO');        // outcome 'won'
    expect(m).toContain(kit.colors.win); // colore vittoria
  });

  it('shows PERSO and loss color for a lost pick', () => {
    const kit = loadBrandKit(KIT_PATH);
    const lost = { ...sample, outcome: 'lost' as const };
    const m = renderMatchResultMarkup(lost, kit);
    expect(m).toContain('PERSO');
    expect(m).toContain(kit.colors.loss);
  });

  it('renders a 1080x1080 PNG', async () => {
    const kit = loadBrandKit(KIT_PATH);
    const png = await renderCard(sample, kit, FONTS_DIR);
    expect(png.subarray(0, 4).toString('hex')).toBe('89504e47');
  });
});
