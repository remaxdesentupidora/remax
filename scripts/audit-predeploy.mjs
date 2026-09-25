/**
 * Auditoria pré-deploy — varre dist/ e reporta apenas erros.
 * Uso: node scripts/audit-predeploy.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const SITE = 'https://desentupidoraremax.com.br';
const FORBIDDEN = [
	/são paulo capital/i,
	/curitiba/i,
	/campinas/i,
	/protec/i,
	/\bwine\b/i,
];

function walk(dir, files = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(full, files);
		else files.push(full);
	}
	return files;
}

function dirSize(dir) {
	return walk(dir).reduce((sum, f) => sum + fs.statSync(f).size, 0);
}

function formatBytes(n) {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function getAttr(tag, name) {
	const re = new RegExp(`${name}=["']([^"']*)["']`, 'i');
	const m = tag.match(re);
	return m ? m[1] : null;
}

function stripTags(html) {
	return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
}

function extractHeadings(html) {
	const body = stripTags(html);
	const headings = [];
	const re = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
	let m;
	while ((m = re.exec(body))) {
		headings.push({ level: Number(m[1]), text: m[2].replace(/<[^>]+>/g, '').trim() });
	}
	return headings;
}

function collectDistRoutes(files) {
	const routes = new Set(['/']);
	for (const f of files) {
		const rel = f.replace(/\\/g, '/').replace(/^dist\/?/, '/');
		if (rel.endsWith('/index.html')) {
			const route = rel.slice(0, -'index.html'.length) || '/';
			routes.add(route);
		} else if (rel.endsWith('.html')) {
			routes.add(rel.replace(/\.html$/, '/').replace(/\/404\/$/, '/404'));
			// 404.html
			if (rel === '/404.html') routes.add('/404.html');
		}
	}
	return routes;
}

function normalizeInternalHref(href) {
	if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:'))
		return null;
	if (href.startsWith('http://') || href.startsWith('https://')) {
		if (!href.startsWith(SITE)) return null;
		href = href.slice(SITE.length) || '/';
	}
	if (!href.startsWith('/')) return null;
	const [pathname] = href.split(/[?#]/);
	if (pathname.includes('.')) return pathname; // file like /favicon.svg
	return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

function routeExists(routes, files, hrefPath) {
	if (!hrefPath) return true;
	if (hrefPath.includes('.')) {
		const filePath = path.join(DIST, hrefPath.replace(/^\//, ''));
		return fs.existsSync(filePath);
	}
	if (routes.has(hrefPath)) return true;
	// trailing slash variants
	const noSlash = hrefPath.replace(/\/$/, '') || '/';
	if (routes.has(noSlash + '/')) return true;
	if (hrefPath === '/404/' && fs.existsSync(path.join(DIST, '404.html'))) return true;
	return false;
}

const files = walk(DIST);
const htmlFiles = files.filter((f) => f.endsWith('.html')).sort();
const routes = collectDistRoutes(files);
const errors = [];
const titles = new Map();
const descriptions = new Map();

function addError(page, msg) {
	errors.push({ page, msg });
}

for (const file of htmlFiles) {
	const page = '/' + file.replace(/\\/g, '/').replace(/^dist\//, '');
	const html = fs.readFileSync(file, 'utf8');

	// titles
	const titleMatches = [...html.matchAll(/<title>([^<]*)<\/title>/gi)];
	if (titleMatches.length === 0) addError(page, '<title> ausente');
	else {
		const t = titleMatches[0][1].trim();
		if (t.length > 60) addError(page, `<title> com ${t.length} caracteres (> 60): "${t}"`);
		if (!titles.has(t)) titles.set(t, []);
		titles.get(t).push(page);
	}

	// description
	const descTag = html.match(
		/<meta\s+[^>]*name=["']description["'][^>]*>/i,
	);
	if (!descTag) addError(page, 'meta description ausente');
	else {
		const d = getAttr(descTag[0], 'content') || '';
		if (d.length > 160)
			addError(page, `meta description com ${d.length} caracteres (> 160)`);
		if (!d) addError(page, 'meta description vazia');
		if (!descriptions.has(d)) descriptions.set(d, []);
		descriptions.get(d).push(page);
	}

	// canonical
	const canonTag = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*>/i);
	if (!canonTag) addError(page, 'canonical ausente');
	else {
		const href = getAttr(canonTag[0], 'href') || '';
		if (!href.endsWith('/')) addError(page, `canonical sem barra final: ${href}`);
		if (!href.startsWith(SITE))
			addError(page, `canonical domínio diferente: ${href}`);
	}

	// OG
	for (const prop of ['og:title', 'og:description', 'og:image', 'og:url']) {
		const re = new RegExp(
			`<meta\\s+[^>]*property=["']${prop}["'][^>]*>`,
			'i',
		);
		if (!re.test(html)) addError(page, `${prop} ausente`);
	}

	// headings
	const headings = extractHeadings(html);
	const h1s = headings.filter((h) => h.level === 1);
	if (h1s.length === 0) addError(page, '<h1> ausente');
	if (h1s.length > 1) addError(page, `mais de um <h1> (${h1s.length})`);
	for (let i = 1; i < headings.length; i++) {
		const prev = headings[i - 1].level;
		const cur = headings[i].level;
		if (cur > prev + 1)
			addError(
				page,
				`heading pulado: h${prev} → h${cur} ("${headings[i].text.slice(0, 40)}")`,
			);
	}

	// images
	const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
	let highPriorityCount = 0;
	for (const img of imgs) {
		const alt = getAttr(img, 'alt');
		if (alt === null) addError(page, '<img> sem atributo alt');
		if (!getAttr(img, 'width')) addError(page, '<img> sem width');
		if (!getAttr(img, 'height')) addError(page, '<img> sem height');
		if ((getAttr(img, 'fetchpriority') || '').toLowerCase() === 'high')
			highPriorityCount++;
	}
	if (highPriorityCount > 1)
		addError(
			page,
			`${highPriorityCount} imagens com fetchpriority="high" (máx. 1)`,
		);

	// internal links
	const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
	for (const href of hrefs) {
		const normalized = normalizeInternalHref(href);
		if (normalized && !routeExists(routes, files, normalized)) {
			// skip hash-only already handled; skip known public assets checked via exists
			addError(page, `link interno quebrado: ${href} → ${normalized}`);
		}
	}

	// JSON-LD
	const ldBlocks = [...html.matchAll(
		/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
	)];
	for (const [, raw] of ldBlocks) {
		try {
			JSON.parse(raw.trim());
		} catch (e) {
			addError(page, `JSON-LD inválido: ${e.message}`);
		}
	}

	// forbidden terms
	for (const re of FORBIDDEN) {
		if (re.test(html))
			addError(page, `menção proibida encontrada: ${re}`);
	}
}

// duplicate titles/descriptions (ignore empty)
for (const [t, pages] of titles) {
	if (t && pages.length > 1)
		for (const page of pages)
			addError(page, `title duplicado entre páginas: "${t}"`);
}
for (const [d, pages] of descriptions) {
	if (d && pages.length > 1)
		for (const page of pages)
			addError(page, `meta description duplicada entre páginas`);
}

// JS files
const jsFiles = files.filter((f) => f.endsWith('.js'));
if (jsFiles.length > 0) {
	for (const f of jsFiles)
		addError('(dist)', `arquivo .js encontrado: ${f.replace(/\\/g, '/')}`);
}

// sizes
const totalSize = dirSize(DIST);
const imageExt = /\.(webp|avif|png|jpe?g|svg|gif|ico)$/i;
const images = files
	.filter((f) => imageExt.test(f))
	.map((f) => ({ file: f.replace(/\\/g, '/'), size: fs.statSync(f).size }))
	.sort((a, b) => b.size - a.size)
	.slice(0, 5);

console.log('=== AUDITORIA PRÉ-DEPLOY ===');
console.log(`Páginas HTML: ${htmlFiles.length}`);
console.log(`Peso total dist/: ${formatBytes(totalSize)}`);
console.log('\nTop 5 imagens:');
for (const img of images) {
	console.log(`  ${formatBytes(img.size).padStart(10)}  ${img.file}`);
}

if (errors.length === 0) {
	console.log('\nNenhum erro encontrado.');
} else {
	console.log(`\nERROS (${errors.length}):`);
	const byPage = new Map();
	for (const e of errors) {
		if (!byPage.has(e.page)) byPage.set(e.page, []);
		byPage.get(e.page).push(e.msg);
	}
	for (const [page, msgs] of [...byPage.entries()].sort()) {
		console.log(`\n${page}`);
		for (const msg of msgs) console.log(`  - ${msg}`);
	}
}

process.exitCode = errors.length ? 1 : 0;
