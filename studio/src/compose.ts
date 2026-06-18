import satori from 'satori';
import { html } from 'satori-html';
import { Resvg } from '@resvg/resvg-js';
import type { LoadedFont } from './brandkit.ts';

export interface ComposeOptions {
  width: number;
  height: number;
  fonts: LoadedFont[];
}

export async function compose(markup: string, opts: ComposeOptions): Promise<Buffer> {
  const vnode = html(markup);
  const svg = await satori(vnode as any, {
    width: opts.width,
    height: opts.height,
    fonts: opts.fonts.map((f) => ({
      name: f.name,
      data: f.data,
      weight: f.weight as any,
      style: f.style,
    })),
  });
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: opts.width } });
  return Buffer.from(resvg.render().asPng());
}
