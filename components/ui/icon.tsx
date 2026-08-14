import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { cssInterop } from 'nativewind';
import { isRtlLanguage } from '@/lib/i18n';

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
  // The disclosure chevron, pointing the way the row goes. Its own shape rather
  // than a mirrored `chevron`, which already means "back" and would then have
  // to mirror twice in Arabic to end up where it started.
  chevron_end: ['M9 4.5 L16 12 L9 19.5'],
  close: ['M6 6 L18 18', 'M18 6 L6 18'],
  flag: ['M6 21 L6 3.5', 'M6 4.5 L18.5 4.5 L15.5 9.5 L18.5 14.5 L6 14.5'],
  shield: ['M12 2.5 L20 6 L20 11.5 C20 16.5 16.5 20 12 21.5 C7.5 20 4 16.5 4 11.5 L4 6 Z'],
  heart: [
    'M12 21 C12 21 4 15.5 4 9.5 C4 6.5 6.2 4.5 8.8 4.5 C10.4 4.5 11.5 5.4 12 6.2 ' +
      'C12.5 5.4 13.6 4.5 15.2 4.5 C17.8 4.5 20 6.5 20 9.5 C20 15.5 12 21 12 21 Z',
  ],
  pin: [
    'M12 21.5 C12 21.5 19 15.2 19 9.8 A7 7 0 0 0 5 9.8 C5 15.2 12 21.5 12 21.5 Z',
    'M9.6 9.6 A2.4 2.4 0 1 0 14.4 9.6 A2.4 2.4 0 1 0 9.6 9.6 Z',
  ],
} as const;

// A tick and a cross are symbols, not directions, so they must not mirror.
const DIRECTIONAL: ReadonlySet<IconName> = new Set(['send', 'chevron', 'chevron_end']);

const sizes = {
  sm: 14,
  md: 18,
  lg: 24,
  // Display only. Nothing at this size is a control, so it is not bound by the
  // 44px touch floor the way the others implicitly are.
  xl: 56,
} as const;

export type IconProps = {
  name: IconName;
  size?: Size;
  // A text-* token class, never a colour value.
  className?: string;
  strokeWidth?: number;
  // Solid rather than outlined. Only shapes drawn as a closed path fill
  // sensibly, which today means heart.
  filled?: boolean;
};

export function Icon({
  name,
  size = 'md',
  className = 'text-fg',
  strokeWidth = 2,
  filled = false,
}: IconProps) {
  const { i18n } = useTranslation();
  const pixels = sizes[size];

  // From the active language, not from I18nManager. react-native-web's
  // I18nManager is a stub whose isRTL property does not exist at all, so it read
  // as undefined and a chevron never mirrored on web however the app was set.
  // The language is the same answer on all three platforms, and it re-renders
  // when the language changes rather than only at launch.
  const mirrored = DIRECTIONAL.has(name) && isRtlLanguage(i18n.language);

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
          fill={filled ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={filled ? 0 : strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </StyledSvg>
  );
}
