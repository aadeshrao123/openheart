import type { PropsWithChildren } from 'react';
import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import appJson from '@/app.json';

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
const { description, themeColor, lang } = appJson.expo.web;

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

        <ScrollViewStyleReset />

        {headNodes}
      </head>

      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
