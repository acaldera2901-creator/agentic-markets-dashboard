import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface BrandFont {
  family: string;
  file: string;
  weight: number;
  style?: 'normal' | 'italic';
}

export interface BrandKit {
  name: string;
  colors: Record<string, string>;
  fonts: BrandFont[];
  logo?: { svgPath?: string | null };
  tone?: string;
}

export interface LoadedFont {
  name: string;
  data: Buffer;
  weight: number;
  style: 'normal' | 'italic';
}

const REQUIRED_COLORS = ['bg', 'text', 'coral', 'win', 'loss'];

export function loadBrandKit(path: string): BrandKit {
  const raw = readFileSync(path, 'utf8');
  const kit = JSON.parse(raw) as BrandKit;
  if (!kit.name) throw new Error('brandkit: missing name');
  if (!kit.colors) throw new Error('brandkit: missing colors');
  for (const c of REQUIRED_COLORS) {
    if (!kit.colors[c]) throw new Error(`brandkit: missing color "${c}"`);
  }
  if (!Array.isArray(kit.fonts) || kit.fonts.length === 0) {
    throw new Error('brandkit: missing fonts');
  }
  return kit;
}

export function loadFonts(kit: BrandKit, fontsDir: string): LoadedFont[] {
  return kit.fonts.map((f) => ({
    name: f.family,
    data: readFileSync(resolve(fontsDir, f.file)),
    weight: f.weight,
    style: f.style ?? 'normal',
  }));
}
