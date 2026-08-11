import { I18nManager } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { cssInterop } from 'nativewind';

// Via `color` and currentColor rather than a stroke utility: `stroke` is not a
// React Native style property, so NativeWind parses `stroke-fg` to nothing and
// the icon renders invisible. `color` is one, and react-native-svg resolves
// currentColor against it on all three platforms.
const StyledSvg = cssInterop(Svg, {
  className: {
    target: 'style',
    nativeStyleToProp: { color: true },
  },
});

type IconName = keyof typeof shapes;
type Size = keyof typeof sizes;

const shapes = {
  check: ['M4 12.5 L9.5 18 L20 6.5'],
  check_double: ['M2 12.5 L7 17.5 L15.5 7', 'M9 12.5 L14 17.5 L22.5 7'],
  send: ['M4 12 L18.5 12', 'M12.5 6 L18.5 12 L12.5 18'],
  chevron: ['M15 4.5 L8 12 L15 19.5'],
  close: ['M6 6 L18 18', 'M18 6 L6 18'],
} as const;

// A tick and a cross are symbols, not directions, so they must not mirror.
const DIRECTIONAL: ReadonlySet<IconName> = new Set(['send', 'chevron']);

const sizes = {
  sm: 14,
  md: 18,
  lg: 24,
} as const;

export type IconProps = {
  name: IconName;
  size?: Size;
  // A text-* token class, never a colour value.
  className?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 'md', className = 'text-fg', strokeWidth = 2 }: IconProps) {
  const pixels = sizes[size];
  const mirrored = DIRECTIONAL.has(name) && I18nManager.isRTL;

  return (
    <StyledSvg
      width={pixels}
      height={pixels}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={mirrored ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      {shapes[name].map((definition) => (
        <Path
          key={definition}
          d={definition}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </StyledSvg>
  );
}
