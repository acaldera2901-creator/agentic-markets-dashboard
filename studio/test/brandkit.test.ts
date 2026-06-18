import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadBrandKit, loadFonts } from '../src/brandkit.ts';

const here = dirname(fileURLToPath(import.meta.url));
// From studio/test/ → ../../../ reaches ~/Desktop, then Maven-Brain/...
const KIT_PATH = resolve(here, '../../../Maven-Brain/brandkits/betredge.json');
const FONTS_DIR = resolve(here, '../assets/fonts');

describe('brandkit', () => {
  it('loads the BetRedge brand kit with colors and fonts', () => {
    const kit = loadBrandKit(KIT_PATH);
    expect(kit.name).toBe('BetRedge');
    expect(kit.colors.coral).toMatch(/^#/);
    expect(kit.fonts.length).toBeGreaterThanOrEqual(2);
  });

  it('throws on missing required color', () => {
    expect(() => loadBrandKit('/no/such/file.json')).toThrow();
  });

  it('loads font buffers for satori', () => {
    const kit = loadBrandKit(KIT_PATH);
    const fonts = loadFonts(kit, FONTS_DIR);
    expect(fonts.length).toBe(kit.fonts.length);
    expect(Buffer.isBuffer(fonts[0].data)).toBe(true);
    expect(fonts[0].name).toBe('Hanken Grotesk');
  });
});
