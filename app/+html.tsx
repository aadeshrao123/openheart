import type { PropsWithChildren } from 'react';
import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import appJson from '@/app.json';
import tokens from '@/tokens';

// The web build has output "static", which takes it down expo-router's server
// rendering path rather than the SPA one. That path never reads expo.web.name,
// expo.web.description, expo.web.themeColor or expo.web.lang: the HTML comes
// from @expo/router-server's fallback document, which emits none of them and
// hardcodes lang="en". Only expo.web.favicon survives, injected by the exporter
// after the render. A +html file replaces that fallback document and is the
// supported place to put a head.
//
// There is deliberately no <title> here. renderStaticContent splices helmet's
// tags in with html.replace('<head>', ...), so they always land ahead of
// anything this file renders, and helmet emits a <title> whether or not one was
// set. The browser takes the first title element, so a title written here is
// never the one used. It is set through expo-router's Head in app/_layout.tsx
// instead, which is the tag helmet emits.
//
// Read from app.json so the name and description live in exactly one place.
// This runs in Node during export and is not part of the client bundle.
const { name, description, themeColor, lang } = appJson.expo.web;

// One document serves every route, so these describe the site rather than the
// page. That is the right trade here: the landing page is the only route worth
// sharing, and every other exported route is an empty application shell that
// robots.txt already asks crawlers to skip.
//
// og:image is deliberately absent. A 1200x630 card does not exist yet, and
// pointing this at the favicon produces a stretched 48px square in every
// preview, which looks worse than the no-image layout the platforms fall back
// to. It is a real gap and it is listed as one.
const SITE_URL = 'https://openheartapp.org';

// expo-font registers faces from JavaScript, so the pre-rendered page drew in
// Times until the bundle ran. Declaring them here makes the first paint correct
// with no JavaScript. Five native family names aliased onto one variable file.
const FONT_FILES = {
  normal: '/fonts/inter-latin-wght-normal.woff2',
  italic: '/fonts/inter-latin-wght-italic.woff2',
};

const fontFaces = Object.values(tokens.fontFamily)
  .map(([family]: string[]) => {
    const weight = family.match(/_(\d{3})/)?.[1] ?? '400';
    const italic = family.endsWith('_Italic');
    const source = italic ? FONT_FILES.italic : FONT_FILES.normal;

    // Normal even for the italic cut: the slant is in the family name, so
    // asking again would let the browser oblique an already oblique face.
    return `@font-face{font-family:'${family}';src:url('${source}')format('woff2');
font-weight:${weight};font-style:normal;font-display:swap}`;
  })
  .join('\n');

// Emitted after the generated stylesheet so the later rule wins.
const fontFallbacks = Object.entries(tokens.fontFamily)
  .map(([role, families]) => {
    const stack = [...(families as string[]), ...tokens.fallbackStack]
      .map((family) => (family.includes(' ') ? `'${family}'` : family))
      .join(',');

    return `.font-${role}{font-family:${stack}}`;
  })
  .join('\n');

// Files under app/ are the one place this codebase uses a default export.
export default function Root({ children }: PropsWithChildren) {
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();

  return (
    <html lang={lang} {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* Pre-rendered once, so it cannot be translated the way the app is: a
            static export has no reader to have a language yet. Everything the
            user sees after the bundle loads goes through i18n as normal. */}
        <meta name="description" content={description} />
        <meta name="theme-color" content={themeColor} />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={name} />
        <meta property="og:title" content={name} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={SITE_URL} />
        <meta name="twitter:card" content="summary" />

        {/* The upright cut draws nearly every character on the page. */}
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href={FONT_FILES.normal}
          crossOrigin="anonymous"
        />

        <style dangerouslySetInnerHTML={{ __html: fontFaces }} />

        <ScrollViewStyleReset />

        {headNodes}

        <style dangerouslySetInnerHTML={{ __html: fontFallbacks }} />
      </head>

      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
