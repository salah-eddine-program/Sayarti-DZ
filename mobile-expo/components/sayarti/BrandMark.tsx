import Svg, { Circle, Path, Rect } from "react-native-svg";

export function BrandMark({ size = 56, dark = false }: { size?: number; dark?: boolean }) {
  const background = dark ? "#FFFFFF" : "#02281C";
  const foreground = dark ? "#02281C" : "#F5F7F1";
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" accessibilityLabel="Sayarti DZ green speedometer and car mark">
      <Circle cx="48" cy="48" r="46" fill={background} />
      <Path d="M19 45A29 29 0 0 1 48 16" fill="none" stroke="#114722" strokeWidth="5.5" strokeLinecap="round" />
      <Path d="M48 16A29 29 0 0 1 68.5 24.5" fill="none" stroke="#FED439" strokeWidth="5.5" strokeLinecap="round" />
      <Path d="M68.5 24.5A29 29 0 0 1 77 45" fill="none" stroke="#F58220" strokeWidth="5.5" strokeLinecap="round" />
      <Path d="m24 37-4-2m15-12-2-5m30 5 2-5m9 17 4-2" fill="none" stroke="#C4E58C" strokeWidth="3.4" strokeLinecap="round" />
      <Path d="m25 58 5-11c1.3-2.8 3.7-4.5 7-4.5h22c3.3 0 5.7 1.7 7 4.5l5 11v10H25z" fill={foreground} />
      <Path d="m35 46.5-3 7h32l-3-7a3.7 3.7 0 0 0-3.5-2.3h-19a3.7 3.7 0 0 0-3.5 2.3Z" fill="#02281C" />
      <Rect x="29" y="57" width="7" height="4" rx="2" fill="#619B15" />
      <Rect x="60" y="57" width="7" height="4" rx="2" fill="#F58220" />
      <Path d="m73 61 8-8a7 7 0 0 0-9-9l-4 4 4 4-9 9 5 5 5-5Z" fill="#FED439" stroke={background} strokeWidth="2" strokeLinejoin="round" />
      <Circle cx="32" cy="69" r="4" fill="#02281C" />
      <Circle cx="61" cy="69" r="4" fill="#02281C" />
    </Svg>
  );
}
