// Genera gli asset del brand BetRedge dai file sorgente ricevuti (logo + banner),
// adattando il mark verde al coral del brand (#FF6A5E) via rotazione di tinta
// (il testo bianco e il trasparente non hanno saturazione -> restano intatti).
//
// Sorgenti (in public/brand-src/):
//   logo-white.png   1390x459  (mark verde + wordmark BIANCO, trasparente)
//   banner.png       3840x2160 (banner "BETR EDGE" all-sports)
// Output:
//   public/logos/betredge-logo.png      logo header (mark coral + testo bianco, trasparente)
//   app/icon.png                          favicon/app-icon (mark coral su tile scura)
//   app/favicon.ico                       idem, formato .ico (wrap PNG 64px)
//   public/banners/hero-allsports.jpg     banner hero (crop alla fascia contenuto ~2.5:1)
//
// Uso: node scripts/gen-brand-logo.mjs
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "public/brand-src");
const HUE = -120;        // green -> coral
const SAT = 1.15;

// --- 1. Logo header: mark coral + testo bianco, trasparente, edge trimmati ---
const logo = await sharp(path.join(SRC, "logo-white.png"))
  .modulate({ hue: HUE, saturation: SAT })
  .trim()
  .toBuffer();
await sharp(logo).png().toFile(path.join(ROOT, "public/logos/betredge-logo.png"));
console.log("✓ public/logos/betredge-logo.png");

// --- 2. Favicon mark: crop B/freccia (sx 430px) -> coral -> tile scura rounded ---
const ICON = 512;
const mark = await sharp(path.join(SRC, "logo-white.png"))
  .extract({ left: 0, top: 0, width: 430, height: 459 })
  .modulate({ hue: HUE, saturation: SAT })
  .resize(Math.round(ICON * 0.74), Math.round(ICON * 0.74), { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();
const tile = Buffer.from(
  `<svg width="${ICON}" height="${ICON}"><rect width="${ICON}" height="${ICON}" rx="${Math.round(ICON * 0.22)}" fill="#0B0C0E"/></svg>`
);
const iconPng = await sharp(await sharp(tile).png().toBuffer())
  .composite([{ input: mark, gravity: "center" }])
  .png()
  .toBuffer();
await writeFile(path.join(ROOT, "app/icon.png"), iconPng);
console.log("✓ app/icon.png");

// --- 3. favicon.ico (wrap di un PNG 64x64 in container ICO, no dipendenze) ---
const ico64 = await sharp(iconPng).resize(64, 64).png().toBuffer();
const ico = Buffer.alloc(22 + ico64.length);
ico.writeUInt16LE(0, 0);            // reserved
ico.writeUInt16LE(1, 2);            // type: icon
ico.writeUInt16LE(1, 4);            // count: 1
ico.writeUInt8(64, 6);              // width
ico.writeUInt8(64, 7);              // height
ico.writeUInt8(0, 8);               // palette
ico.writeUInt8(0, 9);               // reserved
ico.writeUInt16LE(1, 10);           // planes
ico.writeUInt16LE(32, 12);          // bpp
ico.writeUInt32LE(ico64.length, 14);// size of PNG data
ico.writeUInt32LE(22, 18);          // offset
ico64.copy(ico, 22);
await writeFile(path.join(ROOT, "app/favicon.ico"), ico);
console.log("✓ app/favicon.ico");

// --- 4. Banner hero: crop alla fascia contenuto, aspect ~2.5:1 ---
const meta = await sharp(path.join(SRC, "banner.png")).metadata();
const cropH = Math.round(meta.width / 2.5);           // 2.5:1
const top = Math.round((meta.height - cropH) / 2);
await sharp(path.join(SRC, "banner.png"))
  .extract({ left: 0, top, width: meta.width, height: cropH })
  .jpeg({ quality: 88 })
  .toFile(path.join(ROOT, "public/banners/hero-allsports.jpg"));
console.log(`✓ public/banners/hero-allsports.jpg (${meta.width}x${cropH})`);

console.log("\nFatto.");
