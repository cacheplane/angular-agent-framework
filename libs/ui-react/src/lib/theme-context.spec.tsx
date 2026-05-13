import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from './theme-context';

function ThemeReadout() {
  const theme = useTheme();
  return <span data-testid="theme">{theme}</span>;
}

describe('ThemeProvider', () => {
  it('exposes the theme via useTheme', () => {
    render(
      <ThemeProvider theme="dark">
        <ThemeReadout />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme').textContent).toBe('dark');
  });

  it("defaults to 'dark' when no provider is present", () => {
    render(<ThemeReadout />);
    expect(screen.getByTestId('theme').textContent).toBe('dark');
  });
});
