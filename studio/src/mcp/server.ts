import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod/v3';
import { writeFileSync } from 'node:fs';
import { loadBrandKit, loadFonts } from '../brandkit.ts';
import { compose } from '../compose.ts';
import { renderCard, type MatchResultCardData } from '../cards/match-result.ts';
import { settledPickToCardData, fetchLatestSettledPicks } from '../data/pick-adapter.ts';

const BRAND_KIT_PATH = process.env.STUDIO_BRANDKIT_PATH!;
const FONTS_DIR = process.env.STUDIO_FONTS_DIR!;

const server = new McpServer({ name: 'maven-studio', version: '0.1.0' });

server.tool(
  'studio_brandkit_get',
  'Restituisce il brand kit attivo (colori, font, tono).',
  {},
  async () => ({ content: [{ type: 'text', text: JSON.stringify(loadBrandKit(BRAND_KIT_PATH), null, 2) }] }),
);

server.tool(
  'studio_compose',
  'Renderizza markup HTML/CSS on-brand in un PNG su file. Ritorna il path.',
  {
    markup: z.string(),
    width: z.number().default(1080),
    height: z.number().default(1080),
    outPath: z.string(),
  },
  async ({ markup, width, height, outPath }) => {
    const fonts = loadFonts(loadBrandKit(BRAND_KIT_PATH), FONTS_DIR);
    const png = await compose(markup, { width, height, fonts });
    writeFileSync(outPath, png);
    return { content: [{ type: 'text', text: outPath }] };
  },
);

server.tool(
  'studio_match_result_card',
  "Genera la Match Result Card. Senza argomenti usa l'ultima pick settlata; oppure passa i dati.",
  {
    outPath: z.string(),
    data: z
      .object({
        sport: z.enum(['football', 'tennis']),
        home: z.string(),
        away: z.string(),
        score: z.string(),
        pick: z.string(),
        probability: z.number(),
        outcome: z.enum(['won', 'lost']),
        dateLabel: z.string().optional(),
      })
      .optional(),
  },
  async ({ outPath, data }) => {
    let card: MatchResultCardData;
    if (data) {
      card = data;
    } else {
      const rows = await fetchLatestSettledPicks(1);
      if (!rows.length) return { content: [{ type: 'text', text: 'nessuna pick settlata disponibile' }] };
      card = settledPickToCardData(rows[0]);
    }
    const kit = loadBrandKit(BRAND_KIT_PATH);
    const png = await renderCard(card, kit, FONTS_DIR);
    writeFileSync(outPath, png);
    return { content: [{ type: 'text', text: outPath }] };
  },
);

await server.connect(new StdioServerTransport());
