import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

const servicos = defineCollection({
	loader: glob({ pattern: '*.md', base: './src/content/servicos' }),
	schema: ({ image }) =>
		z.object({
			seoTitle: z.string().max(60),
			description: z.string().max(160),
			h1: z.string(),
			resumo: z.string(),
			ordem: z.number(),
			destaqueHome: z.boolean(),
			imagem: image().optional(),
			faq: z
				.array(
					z.object({
						pergunta: z.string(),
						resposta: z.string(),
					}),
				)
				.optional(),
		}),
});

const cidades = defineCollection({
	loader: file('src/data/cidades.json'),
	schema: z.object({
		id: z.string(),
		nome: z.string(),
		uf: z.string(),
		sede: z.boolean(),
	}),
});

const faq = defineCollection({
	loader: file('src/data/faq.json'),
	schema: z.object({
		id: z.string(),
		pergunta: z.string(),
		resposta: z.string(),
		ordem: z.number(),
	}),
});

export const collections = { servicos, cidades, faq };
