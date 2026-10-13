// Puts BASE_PATH in front of the root-relative links the pages are written
// with; Astro already does so for its own.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const base = (process.env.BASE_PATH || '').replace(/\/$/, '');
if (!base) process.exit(0);

const link = /(href|src)="\/(?!\/)([^"]*)"/g;

async function* pages(dir) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* pages(path);
		else if (entry.name.endsWith('.html')) yield path;
	}
}

for await (const page of pages('dist')) {
	const html = await readFile(page, 'utf8');
	const rebased = html.replace(link, (whole, attr, rest) =>
		('/' + rest).startsWith(base + '/') || '/' + rest === base ? whole : `${attr}="${base}/${rest}"`,
	);
	if (rebased !== html) await writeFile(page, rebased);
}
