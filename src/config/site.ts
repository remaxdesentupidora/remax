export const site = {
	nome: 'Desentupidora Remax',
	telefone: '(13) 99620-2540',
	telefoneE164: '+5513996202540',
	whatsappUrl:
		'https://wa.me/5513996202540?text=' +
		encodeURIComponent('Olá! Preciso de um orçamento de desentupimento.'),
	atendimento24h: true,
	/** Placeholder — não inventar; ocultar bloco se null */
	anosNoMercado: null as number | null,
	/** Placeholder — não inventar; ocultar bloco se null */
	clientesAtendidos: null as number | null,
	url: 'https://desentupidoraremax.com.br',
	email: null as string | null,
} as const;

export type SiteConfig = typeof site;

/** Link WhatsApp com mensagem específica da cidade */
export function whatsappCidade(nome: string): string {
	return (
		'https://wa.me/5513996202540?text=' +
		encodeURIComponent(`Olá! Preciso de desentupimento em ${nome}.`)
	);
}
