import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { renderMatchResultToFile } from '../src/render-card.ts';
import type { MatchResultCardData } from '../src/cards/match-result.ts';

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  readFileSync(resolve(here, '../test/fixtures/sample-match.json'), 'utf8'),
) as MatchResultCardData;

const out = await renderMatchResultToFile(data, {
  brandKitPath: resolve(here, '../../../Maven-Brain/brandkits/betredge.json'),
  fontsDir: resolve(here, '../assets/fonts'),
  outPath: resolve(here, '../sample-card.png'),
});
console.log('Card scritta in:', out);
