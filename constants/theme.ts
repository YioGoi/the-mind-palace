/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';
import { AppPalette } from './palette';

const tintColorLight = AppPalette.light.colorPrimary;
const tintColorDark = AppPalette.dark.colorPrimary;

export const Colors = {
  light: {
    text: AppPalette.light.colorTextMain,
    background: AppPalette.light.colorBgMain,
    tint: tintColorLight,
    icon: AppPalette.light.colorTextMuted,
    tabIconDefault: AppPalette.light.colorTextMuted,
    tabIconSelected: tintColorLight,
    primary: AppPalette.light.colorPrimary,
    primarySoft: AppPalette.light.colorPrimarySoft,
    bgElevated: AppPalette.light.colorBgElevated,
    accent: AppPalette.light.colorAccent,
    border: AppPalette.light.colorBorder,
  },
  dark: {
    text: AppPalette.dark.colorTextMain,
    background: AppPalette.dark.colorBgMain,
    tint: tintColorDark,
    icon: AppPalette.dark.colorTextMuted,
    tabIconDefault: AppPalette.dark.colorTextMuted,
    tabIconSelected: tintColorDark,
    primary: AppPalette.dark.colorPrimary,
    primarySoft: AppPalette.dark.colorPrimarySoft,
    bgElevated: AppPalette.dark.colorBgElevated,
    accent: AppPalette.dark.colorAccent,
    border: AppPalette.dark.colorBorder,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const AppFontFamilies = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semiBold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extraBold: 'Manrope_800ExtraBold',
} as const;
