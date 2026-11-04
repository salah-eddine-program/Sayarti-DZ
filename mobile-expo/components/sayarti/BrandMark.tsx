import Svg, { Circle, Path, Rect } from "react-native-svg";

export function BrandMark({ size = 56, dark = false }: { size?: number; dark?: boolean }) {
  const background = dark ? "#FFFFFF" : "#0B3D46";
  const foreground = dark ? "#0B3D46" : "#F5FBF8";
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" accessibilityLabel="Sayarti DZ car and gauge mark">
      <Circle cx="48" cy="48" r="46" fill={background} />
      <Path d="M19 45a29 29 0 0 1 58 0" fill="none" stroke="#13B889" strokeWidth="5" strokeLinecap="round" />
      <Path d="M24 37l-4-2m15-12-2-5m30 5 2-5m9 17 4-2" fill="none" stroke="#8BE5C5" strokeWidth="3.4" strokeLinecap="round" />
      <Path d="M25 58l5-11c1.3-2.8 3.7-4.5 7-4.5h22c3.3 0 5.7 1.7 7 4.5l5 11v10H25z" fill={foreground} />
      <Path d="M35 46.5l-3 7h32l-3-7a3.7 3.7 0 0 0-3.5-2.3h-19a3.7 3.7 0 0 0-3.5 2.3Z" fill="#0B3D46" />
      <Rect x="29" y="57" width="7" height="4" rx="2" fill="#13B889" />
      <Rect x="60" y="57" width="7" height="4" rx="2" fill="#13B889" />
      <Path d="M73 61l8-8a7 7 0 0 0-9-9l-4 4 4 4-9 9 5 5 5-5Z" fill="#13B889" stroke={background} strokeWidth="2" strokeLinejoin="round" />
      <Circle cx="32" cy="69" r="4" fill="#0B3D46" />
      <Circle cx="61" cy="69" r="4" fill="#0B3D46" />
    </Svg>
  );
}
