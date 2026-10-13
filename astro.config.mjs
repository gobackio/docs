// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://docs.goback.io',	integrations: [
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
					items: [
						'self-host/storage',
						'self-host/keys',
						'self-host/retention',
						'self-host/agent',
						'self-host/server',
						'self-host/postgres',
						'self-host/mysql',
					],
				},
				{
					label: 'Go library',
					items: ['library/go'],
				},
				{
					label: 'Concepts',
					items: ['concepts/self-contained', 'concepts/security-model'],
				},
				{
					label: 'CLI reference',
					items: [{ autogenerate: { directory: 'reference/cli' } }],
				},
				{
					label: 'Internals',
					collapsed: true,
					items: [
						'internals/data-model',
						'internals/store-layout',
						'internals/lifecycle',
						'internals/garbage-collection',
						'internals/the-index',
					],
				},
			],
		}),
	],
});
