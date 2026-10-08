// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://docs.goback.io',
	integrations: [
		starlight({
			title: 'goback',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/gobackio/goback' }],
			customCss: ['./src/styles/theme.css'],
			sidebar: [
				{
					label: 'Start here',
					items: ['start/self-host', 'start/cloud', 'start/restore'],
				},
				{
					label: 'Self-host',
					items: ['self-host/storage', 'self-host/keys', 'self-host/retention', 'self-host/server', 'self-host/postgres'],
				},
				{
					label: 'Concepts',
					items: ['concepts/data-model', 'concepts/index-only'],
				},
				{
					label: 'CLI reference',
					items: [{ autogenerate: { directory: 'reference/cli' } }],
				},
			],
		}),
	],
});
