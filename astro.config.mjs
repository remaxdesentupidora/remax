// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
	site: 'https://desentupidoraremax.com.br',
	output: 'static',
	trailingSlash: 'always',
	build: {
		inlineStylesheets: 'always',
	},
	integrations: [
		sitemap({
			filter: (page) =>
				!page.includes('/politica-de-privacidade') && !page.includes('/404'),
		}),
	],
	vite: {
		plugins: [tailwindcss()],
	},
});
