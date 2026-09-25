/**
 * Gera assets estáticos de marca (execução única / sob demanda).
 * - public/og-default.jpg (1200×630)
 * - public/favicon.svg (R em #E02932)
 * - public/apple-touch-icon.png (180×180)
 *
 * Usa sharp do node_modules (peer do Astro); não adiciona dependência de runtime.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const logoPath = path.join(ROOT, 'src/assets/images/logo-desentupidora-remax.png');
const publicDir = path.join(ROOT, 'public');

fs.mkdirSync(publicDir, { recursive: true });

const faviconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Desentupidora Remax">
  <rect width="128" height="128" rx="28" fill="#E02932"/>
  <text x="64" y="88" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="84" font-weight="700" fill="#FFFFFF">R</text>
</svg>
`;

const faviconPath = path.join(publicDir, 'favicon.svg');
fs.writeFileSync(faviconPath, faviconSvg);
console.log('Wrote', faviconPath);

const applePath = path.join(publicDir, 'apple-touch-icon.png');
await sharp(Buffer.from(faviconSvg)).resize(180, 180).png().toFile(applePath);
console.log('Wrote', applePath);

const ogPath = path.join(publicDir, 'og-default.jpg');
const W = 1200;
const H = 630;
const cardW = 520;
const cardH = 220;
const cardX = Math.round((W - cardW) / 2);
const cardY = Math.round((H - cardH) / 2);
const pad = 40;

const logoBuf = await sharp(logoPath)
	.resize({
		width: cardW - pad * 2,
		height: cardH - pad * 2,
		fit: 'inside',
		withoutEnlargement: false,
	})
	.png()
	.toBuffer();
const logoMeta = await sharp(logoBuf).metadata();
const logoLeft = cardX + Math.round((cardW - (logoMeta.width ?? 0)) / 2);
const logoTop = cardY + Math.round((cardH - (logoMeta.height ?? 0)) / 2);

const cardSvg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#082F49"/>
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="24" ry="24" fill="#FFFFFF"/>
</svg>
`);

await sharp(cardSvg)
	.composite([{ input: logoBuf, left: logoLeft, top: logoTop }])
	.jpeg({ quality: 85, mozjpeg: true })
	.toFile(ogPath);

console.log('Wrote', ogPath, await sharp(ogPath).metadata().then((m) => `${m.width}x${m.height}`));
console.log('Done.');
