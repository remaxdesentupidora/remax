/**
 * Gera assets estáticos de marca (execução única / sob demanda).
 * - public/og-default.jpg (1200×630)
 * - public/favicon.svg (R branco em #E02932, em paths)
 * - public/favicon.ico (16, 32 e 48)
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
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Desentupidora Remax">
  <rect width="32" height="32" rx="7" fill="#E02932"/>
  <path fill="#FFFFFF" fill-rule="evenodd" d="M8 6.2h6.4c3.8 0 6.1 1.9 6.1 4.8 0 2.3-1.4 4-3.6 4.6L21.6 25.8h-4.8l-4.2-8.4H11.4V25.8H8V6.2zM11.4 9.1v4.6h2.7c1.6 0 2.5-.8 2.5-2.3s-.9-2.3-2.5-2.3h-2.7z"/>
</svg>
`;

/** ICO moderno com PNG embutido (16/32/48). */
function toIco(pngs) {
	const count = pngs.length;
	let offset = 6 + count * 16;
	const entries = pngs.map((png) => {
		const width = png.readUInt32BE(16);
		const height = png.readUInt32BE(20);
		const entry = { width, height, size: png.length, offset };
		offset += png.length;
		return entry;
	});
	const out = Buffer.alloc(offset);
	out.writeUInt16LE(0, 0);
	out.writeUInt16LE(1, 2);
	out.writeUInt16LE(count, 4);
	entries.forEach((entry, index) => {
		const base = 6 + index * 16;
		out.writeUInt8(entry.width >= 256 ? 0 : entry.width, base);
		out.writeUInt8(entry.height >= 256 ? 0 : entry.height, base + 1);
		out.writeUInt16LE(1, base + 4);
		out.writeUInt16LE(32, base + 6);
		out.writeUInt32LE(entry.size, base + 8);
		out.writeUInt32LE(entry.offset, base + 12);
	});
	pngs.forEach((png, index) => png.copy(out, entries[index].offset));
	return out;
}

const faviconPath = path.join(publicDir, 'favicon.svg');
fs.writeFileSync(faviconPath, faviconSvg);
console.log('Wrote', faviconPath);

const applePath = path.join(publicDir, 'apple-touch-icon.png');
await sharp(Buffer.from(faviconSvg)).resize(180, 180).png().toFile(applePath);
console.log('Wrote', applePath);

const icoPngs = await Promise.all(
	[16, 32, 48].map((size) =>
		sharp(Buffer.from(faviconSvg)).resize(size, size).png().toBuffer(),
	),
);
const icoPath = path.join(publicDir, 'favicon.ico');
fs.writeFileSync(icoPath, toIco(icoPngs));
console.log('Wrote', icoPath);

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
