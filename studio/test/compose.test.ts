import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { compose } from '../src/compose.ts';
import { loadBrandKit, loadFonts } from '../src/brandkit.ts';

const here = dirname(fileURLToPath(import.meta.url));
const KIT_PATH = resolve(here, '../../../Maven-Brain/brandkits/betredge.json');
const FONTS_DIR = resolve(here, '../assets/fonts');

describe('compose', () => {
  it('renders markup to a PNG buffer of the requested size', async () => {
    const fonts = loadFonts(loadBrandKit(KIT_PATH), FONTS_DIR);
    const markup = `
      <div style="display:flex;width:100%;height:100%;background:#0B0D12;
                  color:#F5F7FA;font-family:Hanken Grotesk;align-items:center;
                  justify-content:center;font-size:64px;font-weight:700">
        Ciao Studio
      </div>`;
    const png = await compose(markup, { width: 1080, height: 1080, fonts });
    // PNG signature: 89 50 4E 47
    expect(png.subarray(0, 4).toString('hex')).toBe('89504e47');
    expect(png.length).toBeGreaterThan(1000);
  });
});
