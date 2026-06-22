// Genera l'icona "All Sports" del selettore sport (landing) nei due formati degli
// altri sport (public/banners/sport-*.png), a partire dall'immagine sorgente
// generata con Gemini (cluster di palloni 3D + scia coral, stile identico agli altri):
//   sorgente: public/banners/sport-allsports-src.png  (1:1, es. 1024x1024)
//   output:   sport-allsports.png      320x320 (master)
//             sport-allsports-sm.png    64x64  (-sm)
//
// Center-crop (CROP_KEEP) per: (1) togliere il watermark Gemini nell'angolo,
// (2) stringere l'inquadratura come le altre icone (il soggetto riempie di più).
// Uso:  node scripts/gen-allsports-icon.mjs
import sharp from "sharp";
import path from "node:path";

const OUT_DIR = path.resolve(process.cwd(), "public/banners");
const SRC = path.join(OUT_DIR, "sport-allsports-src.png");
const CROP_KEEP = 0.76; // frazione centrale mantenuta (12% via per lato)

const main = async () => {
  const meta = await sharp(SRC).metadata();
  const side = Math.min(meta.width, meta.height);
  const keep = Math.round(side * CROP_KEEP);
  const off = Math.round((side - keep) / 2);
  const cropped = await sharp(SRC)
    .extract({ left: off, top: off, width: keep, height: keep })
    .toBuffer();

  for (const [name, px] of [["sport-allsports.png", 320], ["sport-allsports-sm.png", 64]]) {
    await sharp(cropped).resize(px, px, { fit: "cover" }).png().toFile(path.join(OUT_DIR, name));
    console.log(`✓ ${name} (${px}x${px})`);
  }
  console.log(`\nGenerati in ${OUT_DIR} (crop centrale ${Math.round(CROP_KEEP * 100)}%)`);
};

main().catch((e) => { console.error(e); process.exit(1); });
