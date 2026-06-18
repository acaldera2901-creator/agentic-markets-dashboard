import { compose } from '../compose.ts';
import { loadFonts, type BrandKit } from '../brandkit.ts';

export type Sport = 'football' | 'tennis';
export type Outcome = 'won' | 'lost';

export interface MatchResultCardData {
  sport: Sport;
  home: string;
  away: string;
  score: string;
  pick: string;
  probability: number; // 0..1
  outcome: Outcome;
  dateLabel?: string;
}

function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

export function renderMatchResultMarkup(d: MatchResultCardData, kit: BrandKit): string {
  const c = kit.colors;
  const isWin = d.outcome === 'won';
  const verdict = isWin ? 'VINTO' : 'PERSO';
  const verdictColor = isWin ? c.win : c.loss;
  const sportLabel = d.sport === 'tennis' ? 'TENNIS' : 'CALCIO';
  return `
  <div style="display:flex;flex-direction:column;width:100%;height:100%;
              background:${c.bg};color:${c.text};font-family:Hanken Grotesk;
              padding:80px;justify-content:space-between">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;font-weight:700;font-size:40px;color:${c.coral}">BetRedge</div>
      <div style="display:flex;font-family:JetBrains Mono;font-size:28px;color:${c.muted}">
        ${sportLabel}${d.dateLabel ? ' · ' + d.dateLabel : ''}
      </div>
    </div>

    <div style="display:flex;flex-direction:column;align-items:center">
      <div style="display:flex;font-size:64px;font-weight:700;text-align:center">
        ${d.home} vs ${d.away}
      </div>
      <div style="display:flex;font-family:JetBrains Mono;font-size:120px;font-weight:700;
                  color:${c.text};margin-top:24px">
        ${d.score}
      </div>
    </div>

    <div style="display:flex;flex-direction:column;background:${c.surface};
                border-radius:32px;padding:48px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
        <div style="display:flex;font-size:34px;color:${c.muted}">La nostra pick</div>
        <div style="display:flex;font-size:34px;font-weight:700">${d.pick}</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;font-size:34px;color:${c.muted}">Probabilità calcolata</div>
        <div style="display:flex;font-family:JetBrains Mono;font-size:48px;font-weight:700;color:${c.coral}">
          ${pct(d.probability)}
        </div>
      </div>
      <div style="display:flex;justify-content:center;margin-top:40px">
        <div style="display:flex;font-size:56px;font-weight:700;color:${verdictColor};
                    letter-spacing:4px">${verdict}</div>
      </div>
    </div>
  </div>`;
}

export async function renderCard(
  d: MatchResultCardData,
  kit: BrandKit,
  fontsDir: string,
): Promise<Buffer> {
  const fonts = loadFonts(kit, fontsDir);
  const markup = renderMatchResultMarkup(d, kit);
  return compose(markup, { width: 1080, height: 1080, fonts });
}
