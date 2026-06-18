import { writeFileSync } from 'node:fs';
import { renderCard, type MatchResultCardData } from './cards/match-result.ts';
import { loadBrandKit, type BrandKit } from './brandkit.ts';

export interface RenderToFileOptions {
  brandKitPath: string;
  fontsDir: string;
  outPath: string;
}

export async function renderMatchResultToFile(
  data: MatchResultCardData,
  opts: RenderToFileOptions,
): Promise<string> {
  const kit: BrandKit = loadBrandKit(opts.brandKitPath);
  const png = await renderCard(data, kit, opts.fontsDir);
  writeFileSync(opts.outPath, png);
  return opts.outPath;
}
