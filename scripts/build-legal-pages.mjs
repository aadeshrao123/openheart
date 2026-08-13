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

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public');

// The app's own face, self hosted next to the pages that use it. Copied from
// node_modules rather than committed by hand so a font upgrade is one npm
// install, and served locally rather than from Google's CDN because a legal
// page that phones a third party while explaining that the app does not track
// you is its own kind of wrong.
//
// Two weights, not three. Regular carries the body and ExtraBold carries the
// headings and the bold runs inside them, which avoids the browser synthesising
// a bold from the regular cut.
const FONTS = [
  { family: 'PlusJakartaSans_400Regular', weight: 400, dir: '400Regular' },
  { family: 'PlusJakartaSans_800ExtraBold', weight: 800, dir: '800ExtraBold' },
];

// The same mark components/ui/logo.tsx draws, as inline SVG so the header needs
// no image request.
const HEART =
  'M12 20.7l-1.45-1.32C5.4 14.74 2 11.66 2 7.9 2 4.82 4.42 2.4 7.5 2.4c1.74 0 ' +
  '3.41.81 4.5 2.09 1.09-1.28 2.76-2.09 4.5-2.09 3.08 0 5.5 2.42 5.5 5.5 0 ' +
  '3.76-3.4 6.84-8.55 11.49L12 20.7z';

const INTERNAL_SECTION = /\n## Open items[\s\S]*$/;

const SITE = 'https://openheartapp.org';
const REPOSITORY = 'https://github.com/aadeshrao123/openheart';
const CONTACT = 'support@openheartapp.org';
const APP_NAME = 'OpenHeart';

// Cloudflare Pages serves foo.html at /foo, so the extension never appears in a
// link. Keeping that in one function means the nav, the footer and the sitemap
// cannot disagree about what a page is called.
const href = (out) => `/${out.replace(/\.html$/, '')}`;

const mark = (size) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">` +
  `<path d="${HEART}"/></svg>`;

function navigation(current) {
  const links = PAGES.map((page) => {
    const active = page.out === current ? ' aria-current="page"' : '';

    return `<a href="${href(page.out)}"${active}>${page.title}</a>`;
  });

  return [...links, `<a class="cta" href="/sign-in">Sign in</a>`].join('\n      ');
}

// Read out of global.css rather than copied, because a legal page that does not
// look like the app it belongs to reads as somebody else's page, and these were
// copied once and then sat one palette behind it. Comments are stripped first
// for the same reason check-contrast.mjs strips them: global.css explains the
// dark block in prose, and an unstripped file matches ".dark:root" inside that
// comment for both themes.
const CSS = readFileSync(path.join(ROOT, 'global.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const USED_TOKENS = ['bg', 'surface', 'border', 'fg', 'fg-muted', 'brand'];

function palette(pattern) {
  const block = CSS.match(pattern);

  if (!block) {
    throw new Error(`global.css: no rule matched ${pattern}`);
  }

  return USED_TOKENS.map((name) => {
    const declared = block[1].match(new RegExp(`--${name}:\\s*([0-9]+ [0-9]+ [0-9]+)\\s*;`));

    if (!declared) {
      throw new Error(`global.css: no --${name} in ${pattern}`);
    }

    return `  --${name}: ${declared[1]};`;
  }).join('\n');
}

const STYLE = `
:root {
${palette(/(?<![\w.-]):root\s*\{([^}]*)\}/)}
}

@media (prefers-color-scheme: dark) {
  :root {
${palette(/\.dark:root\s*\{([^}]*)\}/)}
  }
}

${FONTS.map(
  (font) => `@font-face {
  font-family: 'Plus Jakarta Sans';
  src: url('/fonts/${font.family}.ttf') format('truetype');
  font-weight: ${font.weight};
  font-style: normal;
  font-display: swap;
}`,
).join('\n')}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: rgb(var(--bg));
  color: rgb(var(--fg));
  font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
  font-size: 17px;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}

/* 800 rather than 700, because that is the cut actually loaded. Asking for a
   weight between the two makes the browser synthesise one by smearing the
   regular, which is the blurry bold nobody can name but everybody notices. */
strong, b, th { font-weight: 800; }

.shell { max-width: 60rem; margin: 0 auto; padding: 0 1.25rem; }

main { max-width: 42rem; margin: 0 auto; padding: 3rem 0 5rem; }

a { color: rgb(var(--brand)); text-underline-offset: 2px; }

header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgb(var(--bg) / 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgb(var(--border));
}

header .shell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  min-height: 60px;
  flex-wrap: wrap;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: rgb(var(--fg));
  text-decoration: none;
  font-weight: 800;
  font-size: 1.05rem;
  letter-spacing: -0.02em;
}

.brand svg { fill: rgb(var(--brand)); }

nav { display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap; }

nav a {
  color: rgb(var(--fg-muted));
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 150ms ease;
}

nav a:hover { color: rgb(var(--fg)); }
nav a[aria-current='page'] { color: rgb(var(--fg)); font-weight: 800; }

nav a.cta {
  color: rgb(var(--brand));
  font-weight: 800;
}

h1 {
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.03em;
  margin: 0 0 1.5rem;
}

h2 {
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 3rem 0 0.75rem;
}

h3 { font-size: 1.1rem; font-weight: 800; margin: 2rem 0 0.5rem; }

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
  border-top: 1px solid rgb(var(--border));
  color: rgb(var(--fg-muted));
  font-size: 0.9rem;
  padding: 2.5rem 0 3.5rem;
}

footer .shell { display: flex; flex-direction: column; gap: 1rem; }

.footer-links { display: flex; flex-wrap: wrap; gap: 0.35rem 1.5rem; }

footer a { color: rgb(var(--fg-muted)); text-decoration: none; }
footer a:hover { color: rgb(var(--fg)); }

@media (max-width: 640px) {
  h1 { font-size: 2rem; }
  header .shell { padding-top: 0.75rem; padding-bottom: 0.75rem; }
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
  {
    source: 'privacy-policy.md',
    out: 'privacy.html',
    title: 'Privacy Policy',
    summary: 'What is collected, what is not, and why location is rounded before it is stored.',
  },
  {
    source: 'terms-of-service.md',
    out: 'terms.html',
    title: 'Terms of Service',
    summary: 'The rules of use, the age requirement, and what gets an account suspended.',
  },
  {
    source: 'account-deletion.md',
    out: 'account-deletion.html',
    title: 'Deleting your account',
    summary: 'How to delete an account from the app or by email, and what survives deletion.',
  },
];

mkdirSync(OUT, { recursive: true });

// Kept so llms-full.txt below serves the same text the HTML does, stripped of
// the internal section once rather than twice.
const publishedMarkdown = new Map();

for (const page of PAGES) {
  const markdown = readFileSync(path.join(ROOT, 'docs', 'legal', page.source), 'utf8');
  const published = markdown.replace(INTERNAL_SECTION, '\n');

  publishedMarkdown.set(page.source, published);

  if (published.includes('## Open items')) {
    throw new Error(`${page.source}: internal section survived the strip`);
  }

  const body = marked.parse(published, { mangle: false, headerIds: false });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${page.title} - ${APP_NAME}</title>
<meta name="description" content="${page.summary}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${APP_NAME}">
<meta property="og:title" content="${page.title} - ${APP_NAME}">
<meta property="og:description" content="${page.summary}">
<meta name="twitter:card" content="summary">
<style>${STYLE}</style>
</head>
<body>
<header>
  <div class="shell">
    <a class="brand" href="/">${mark(22)}${APP_NAME}</a>
    <nav>${navigation(page.out)}</nav>
  </div>
</header>

<main>
${NOTICE}
${body}
</main>

<footer>
  <div class="shell">
    <a class="brand" href="/">${mark(18)}${APP_NAME}</a>

    <div class="footer-links">
      <a href="/">Home</a>
${PAGES.map((entry) => `      <a href="${href(entry.out)}">${entry.title}</a>`).join('\n')}
      <a href="${REPOSITORY}">Source</a>
      <a href="mailto:${CONTACT}">${CONTACT}</a>
    </div>

    <div>Free software. No ads, no trackers, no paywall.</div>
  </div>
</footer>
</body>
</html>
`;

  writeFileSync(path.join(OUT, page.out), html, 'utf8');
  console.log(`${page.out}: ${(html.length / 1024).toFixed(1)}KB`);
}

mkdirSync(path.join(OUT, 'fonts'), { recursive: true });

for (const font of FONTS) {
  const source = path.join(
    ROOT,
    'node_modules',
    '@expo-google-fonts',
    'plus-jakarta-sans',
    font.dir,
    `${font.family}.ttf`,
  );

  copyFileSync(source, path.join(OUT, 'fonts', `${font.family}.ttf`));
}

console.log(`fonts: ${FONTS.length} weights copied`);

// The sitemap is written here rather than by hand because this file already
// knows every public URL. Cloudflare Pages serves foo.html at /foo, so the
// extension is dropped. No lastmod: a build stamp would change on every deploy
// whether or not the page did, which is worth less than nothing to a crawler.
//
// The landing page is listed first and is the only entry not generated above.
// Every other route in the export needs a session and is disallowed in
// robots.txt, so nothing else belongs here.

const urls = ['/', ...PAGES.map((page) => href(page.out))];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${SITE}${url}</loc></url>`).join('\n')}
</urlset>
`;

writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap, 'utf8');
console.log(`sitemap.xml: ${urls.length} URLs`);

// llms.txt, per llmstxt.org: an index for a model reading the site, and
// llms-full.txt with the text itself so it never has to render the app to find
// out what this is. Both are generated, and the landing copy is read from the
// English bundle the app renders, so the page and the file cannot disagree.
//
// This is worth more here than it usually is. The site is a single JavaScript
// application, and a model that does not execute it sees the pre-rendered
// markup and nothing else. Plain text costs nothing and removes the question.
const en = JSON.parse(readFileSync(path.join(ROOT, 'locales', 'en.json'), 'utf8'));

const copy = Object.fromEntries(
  Object.entries(en.landing).map(([key, value]) => [
    key,
    value.replace(/\{\{appName\}\}/g, APP_NAME),
  ]),
);

const COMPARED = [
  'feature_likes',
  'feature_reach',
  'feature_receipts',
  'feature_filters',
  'feature_ads',
];

const PRINCIPLES = ['money', 'safety', 'data'];
const STEPS = ['verify', 'browse', 'talk'];
const SAFEGUARDS = ['safety_scanning', 'safety_blocking', 'safety_queue', 'safety_location'];

const section = (title, body) => `### ${title}\n\n${body}`;

const pageLinks = PAGES.map((page) => {
  const url = `${SITE}${href(page.out)}`;

  return `- [${page.title}](${url}): ${page.summary}`;
}).join('\n');

const principleSections = PRINCIPLES.map((name) =>
  section(copy[`principle_${name}_title`], copy[`principle_${name}_body`]),
).join('\n\n');

const stepSections = STEPS.map((name) =>
  section(copy[`step_${name}_title`], copy[`step_${name}_body`]),
).join('\n\n');

const legalText = PAGES.map(
  (page) => `\n---\n\n${publishedMarkdown.get(page.source).trim()}`,
).join('\n');

const index = `# ${APP_NAME}

> ${copy.subhead}

${copy.eyebrow}. Source code, including every database policy described on the
site, is public under the AGPL-3.0.

## Pages

- [${APP_NAME}](${SITE}/): ${copy.headline} ${copy.compare_body}
${pageLinks}

## Source

- [Repository](${REPOSITORY}): The whole application, AGPL-3.0.

## Optional

- [Full text](${SITE}/llms-full.txt): Everything above as one plain text file.
`;

const full = `# ${APP_NAME}

> ${copy.subhead}

## ${copy.headline}

${copy.eyebrow}.

## ${copy.compare_title}

${copy.compare_body}

Each of these is charged for by a typical dating app and included here:

${COMPARED.map((key) => `- ${copy[key]}`).join('\n')}

## ${copy.principles_title}

${copy.principles_body}

${principleSections}

## ${copy.steps_title}

${stepSections}

## ${copy.safety_title}

${copy.safety_body}

${SAFEGUARDS.map((key) => `- ${copy[key]}`).join('\n')}

## ${copy.open_title}

${copy.open_body}

Repository: ${REPOSITORY}
Contact: ${CONTACT}

${legalText}
`;

writeFileSync(path.join(OUT, 'llms.txt'), index, 'utf8');
writeFileSync(path.join(OUT, 'llms-full.txt'), full, 'utf8');
console.log(`llms.txt: ${(index.length / 1024).toFixed(1)}KB`);
console.log(`llms-full.txt: ${(full.length / 1024).toFixed(1)}KB`);
