'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Theme } from '@ngaf/design-tokens';

const ThemeContext = createContext<Theme>('dark');

export interface ThemeProviderProps {
  theme: Theme;
  children: ReactNode;
}

/**
 * Provides the current theme to descendants. Cockpit's root layout reads
 * the theme cookie server-side and passes it in; `<ThemedFrame>` and
 * `<ThemeToggle>` consume via `useTheme()`.
 */
export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
