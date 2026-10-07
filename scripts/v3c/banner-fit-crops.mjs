// scripts/v3c/banner-fit-crops.mjs (#REDESIGN-V3C banners-fix) — i ritagli «fit» dei banner della fascia,
// presi dai verticali 1080×1350 del kit (redesign/brand/banners): soggetto intero con margine.
// Nessuna immagine generata: solo extract + resize + AVIF/WebP. Uso: node scripts/v3c/banner-fit-crops.mjs
import sharp from "sharp";
const K = process.env.KIT ?? `${process.env.HOME}/Desktop/01-BETREDGE/redesign/brand/banners`;
const OUT = "public/brand/v3c/banners";
const CROPS = {
  // soggetto intero (testa→scarpini, palla con 100 px d'aria a destra) dal verticale 1080×1350
  "hero-football": { src: "social-football-1080x1350.png", left: 40, top: 290, width: 1040, height: 700 },
  // palla, racchetta, mano, testa; taglio sul petto (la maglia), mai su testa o mani
  "hero-tennis": { src: "social-tennis-1080x1350.png", left: 0, top: 45, width: 1080, height: 655 },
};
await (async () => {
  for (const [name, c] of Object.entries(CROPS)) {
    for (const w of [360, 720]) {
      const base = sharp(`${K}/${c.src}`).extract({ left: c.left, top: c.top, width: c.width, height: c.height }).resize({ width: w });
      await base.clone().avif({ quality: 45, effort: 6 }).toFile(`${OUT}/${name}-fit-${w}.avif`);
      await base.clone().webp({ quality: 70 }).toFile(`${OUT}/${name}-fit-${w}.webp`);
      const m = await sharp(`${OUT}/${name}-fit-${w}.webp`).metadata();
      console.log(name, w, m.width + "x" + m.height);
    }
  }
})();
