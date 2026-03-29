import { StyleSheet, Text, type TextProps } from 'react-native';

import { AppFontFamilies } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontFamily: AppFontFamilies.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontFamily: AppFontFamilies.semiBold,
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontFamily: AppFontFamilies.extraBold,
    fontSize: 32,
    lineHeight: 36,
  },
  subtitle: {
    fontFamily: AppFontFamilies.bold,
    fontSize: 20,
    lineHeight: 26,
  },
  link: {
    fontFamily: AppFontFamilies.medium,
    lineHeight: 30,
    fontSize: 16,
    color: '#0a7ea4',
  },
});
