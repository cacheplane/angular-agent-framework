# Chat Theming with @cacheplane/chat

<Summary>
Customize chat appearance using CSS custom properties and
CHAT_THEME_STYLES. Create theme presets and build a theme picker
for runtime theme switching.
</Summary>

<Prompt>
Add theming to your chat interface using CSS custom properties and
`CHAT_THEME_STYLES` from `@cacheplane/chat`. Create theme presets
and a theme picker for switching themes at runtime.
</Prompt>

<Steps>
<Step title="Understand theme variables">

Chat components use CSS custom properties for all visual styling:

```css
--chat-bg: #171717;
--chat-text: #e0e0e0;
--chat-accent: #3b82f6;
--chat-surface: #222;
--chat-border: #333;
--chat-text-muted: #777;
```

</Step>
<Step title="Apply CHAT_THEME_STYLES">

Use `CHAT_THEME_STYLES` to apply a complete theme:

```typescript
import { CHAT_THEME_STYLES } from '@cacheplane/chat';
```

</Step>
<Step title="Create theme presets">

Define theme presets as objects mapping CSS custom properties:

```typescript
const themes = {
  dark: { '--chat-bg': '#171717', '--chat-text': '#e0e0e0' },
  light: { '--chat-bg': '#ffffff', '--chat-text': '#1a1a1a' },
  ocean: { '--chat-bg': '#0c1426', '--chat-text': '#c8d6e5' },
};
```

</Step>
<Step title="Build a theme picker">

Create buttons that swap CSS variables on the host element:

```typescript
setTheme(name: string) {
  const theme = this.themes[name];
  Object.entries(theme).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
}
```

</Step>
<Step title="Customize per-component">

Override specific component styles without affecting the global theme:

```css
chat-input {
  --chat-input-bg: #1a1a2e;
}
```

</Step>
</Steps>

<Tip>
CHAT_THEME_STYLES provides sensible defaults. Override only the
properties you need to change for your brand.
</Tip>
