// Renders docs/legal/*.md into public/, which Expo copies into the web export.
//
//   node scripts/build-legal-pages.mjs
//
// Generated rather than hand written, so the published page and the tracked
// markdown cannot drift. Editing the HTML is always the wrong move: edit the
// markdown and run this.
//
// The "Open items" section at the end of each document is internal. It names
// the questions a lawyer still has to answer, which belongs in the repository
// and not on the website.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public');

const INTERNAL_SECTION = /\n## Open items[\s\S]*$/;

// The same values as global.css, because a legal page that does not look like
// the app it belongs to reads as somebody else's page.
const STYLE = `
:root {
  --bg: 252 250 247;
  --surface: 246 243 238;
  --border: 226 220 211;
  --fg: 28 25 23;
  --fg-muted: 106 99 92;
  --brand: 166 58 76;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: 22 20 19;
    --surface: 31 28 27;
    --border: 60 54 51;
    --fg: 244 240 235;
    --fg-muted: 168 158 150;
    --brand: 224 132 142;
  }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  padding: 3rem 1.25rem 6rem;
  background: rgb(var(--bg));
  color: rgb(var(--fg));
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  font-size: 17px;
  line-height: 1.65;
}

main { max-width: 42rem; margin: 0 auto; }

a { color: rgb(var(--brand)); }

h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 1.5rem; }
h2 { font-size: 1.35rem; margin: 2.75rem 0 0.75rem; }
h3 { font-size: 1.1rem; margin: 2rem 0 0.5rem; }

hr { border: 0; border-top: 1px solid rgb(var(--border)); margin: 2.5rem 0; }

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.25rem 0;
  font-size: 0.95rem;
  display: block;
  overflow-x: auto;
}

th, td {
  border: 1px solid rgb(var(--border));
  padding: 0.5rem 0.7rem;
  text-align: start;
  vertical-align: top;
}

th { background: rgb(var(--surface)); }

code {
  background: rgb(var(--surface));
  padding: 0.1rem 0.35rem;
  border-radius: 0.25rem;
  font-size: 0.9em;
}

.notice {
  background: rgb(var(--surface));
  border: 1px solid rgb(var(--border));
  border-inline-start: 3px solid rgb(var(--brand));
  padding: 1rem 1.25rem;
  border-radius: 0.5rem;
  margin-bottom: 2.5rem;
  color: rgb(var(--fg-muted));
  font-size: 0.95rem;
}

footer {
  margin-top: 4rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgb(var(--border));
  color: rgb(var(--fg-muted));
  font-size: 0.9rem;
}
`;

// Accurate rather than reassuring. Nobody has an account yet, so nothing here
// governs anyone, and saying so is better than implying a policy is in force.
const NOTICE = `
<div class="notice">
  <strong>OpenHeart is not open to the public yet.</strong>
  This document describes how the app will work when it launches. It has not
  been reviewed by a lawyer, and it may change before anyone can sign up.
</div>
`;

const PAGES = [
  { source: 'privacy-policy.md', out: 'privacy.html', title: 'Privacy Policy' },
  { source: 'terms-of-service.md', out: 'terms.html', title: 'Terms of Service' },
];

mkdirSync(OUT, { recursive: true });

for (const page of PAGES) {
  const markdown = readFileSync(path.join(ROOT, 'docs', 'legal', page.source), 'utf8');
  const published = markdown.replace(INTERNAL_SECTION, '\n');

  if (published.includes('## Open items')) {
    throw new Error(`${page.source}: internal section survived the strip`);
  }

  const body = marked.parse(published, { mangle: false, headerIds: false });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${page.title} - OpenHeart</title>
<meta name="description" content="${page.title} for OpenHeart, a free and open source dating app.">
<style>${STYLE}</style>
</head>
<body>
<main>
${NOTICE}
${body}
<footer>
  <a href="/">OpenHeart</a> &middot;
  <a href="mailto:support@openheartapp.org">support@openheartapp.org</a> &middot;
  <a href="https://github.com/aadeshrao123/openheart">Source</a>
</footer>
</main>
</body>
</html>
`;

  writeFileSync(path.join(OUT, page.out), html, 'utf8');
  console.log(`${page.out}: ${(html.length / 1024).toFixed(1)}KB`);
}
