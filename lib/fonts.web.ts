// Web loads the faces from the @font-face block in app/+html.tsx, which needs
// no JavaScript. Letting expo-font register them too downloaded a second copy
// as static TTFs, about 1.7MB against 48KB of variable woff2.
export const appFonts = {};
