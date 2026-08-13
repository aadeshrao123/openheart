import Svg, { Path } from 'react-native-svg';
import { cssInterop } from 'nativewind';

// The one file allowed to write a colour value, and the reason is that these
// are not colours. Google's guidelines fix the four hues of the G, so drawing
// it in a theme token would make it a different logo and an unusable one. X is
// monochrome, so it takes currentColor and flips with the theme as normal.

const StyledSvg = cssInterop(Svg, {
  className: { target: 'style', nativeStyleToProp: { color: true } },
});

const GOOGLE_BLUE =
  'M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 ' +
  '6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z';

const GOOGLE_GREEN =
  'M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 ' +
  '2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z';

const GOOGLE_YELLOW =
  'M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 ' +
  '17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z';

const GOOGLE_RED =
  'M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 ' +
  '15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z';

const X_GLYPH =
  'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 ' +
  '21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 ' +
  '4.126H5.117z';

const marks = {
  google: {
    viewBox: '0 0 48 48',
    paths: [
      { d: GOOGLE_BLUE, fill: '#4285F4' },
      { d: GOOGLE_GREEN, fill: '#34A853' },
      { d: GOOGLE_YELLOW, fill: '#FBBC05' },
      { d: GOOGLE_RED, fill: '#EA4335' },
    ],
  },
  x: {
    viewBox: '0 0 24 24',
    paths: [{ d: X_GLYPH, fill: 'currentColor' }],
  },
} as const;

export type BrandName = keyof typeof marks;

export type BrandMarkProps = {
  name: BrandName;
  size?: number;
  // A text-* token class, and it reaches the X glyph only.
  className?: string;
};

export function BrandMark({ name, size = 19, className = 'text-fg' }: BrandMarkProps) {
  const mark = marks[name];

  return (
    <StyledSvg width={size} height={size} viewBox={mark.viewBox} className={className}>
      {mark.paths.map((path) => (
        <Path key={path.d} d={path.d} fill={path.fill} />
      ))}
    </StyledSvg>
  );
}
