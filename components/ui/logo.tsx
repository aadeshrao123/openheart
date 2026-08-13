import Svg, { Path } from 'react-native-svg';
import { cssInterop } from 'nativewind';

const StyledSvg = cssInterop(Svg, {
  className: { target: 'style', nativeStyleToProp: { color: true } },
});

const HEART =
  'M12 20.7l-1.45-1.32C5.4 14.74 2 11.66 2 7.9 2 4.82 4.42 2.4 7.5 2.4c1.74 0 ' +
  '3.41.81 4.5 2.09 1.09-1.28 2.76-2.09 4.5-2.09 3.08 0 5.5 2.42 5.5 5.5 0 ' +
  '3.76-3.4 6.84-8.55 11.49L12 20.7z';

export type LogoProps = {
  size?: number;
  // A text-* token class. The mark is one colour and follows it.
  className?: string;
};

export function Logo({ size = 28, className = 'text-brand' }: LogoProps) {
  return (
    <StyledSvg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <Path d={HEART} fill="currentColor" />
    </StyledSvg>
  );
}
