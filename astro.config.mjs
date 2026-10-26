// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// SITE and BASE_PATH come from the Pages settings in CI: the github.io
// address serves the site under /docs until the custom domain is set.
const site = process.env.SITE || 'https://docs.goback.io';
const base = process.env.BASE_PATH || undefined;

export default defineConfig({
	site,
	base,
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
					items: [
						'self-host/storage',
						'self-host/keys',
						'self-host/retention',
						'self-host/reseal',
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
					items: ['concepts/sets', 'concepts/storage', 'concepts/retention', 'concepts/self-contained', 'concepts/security-model'],
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
