# Chat Theming with @threadplane/chat

<Summary>
Customize chat appearance using `--ngaf-chat-*` CSS custom properties. Create theme presets and build a theme picker for runtime theme switching.
</Summary>

<Prompt>
Add theming to your chat interface using `--ngaf-chat-*` CSS custom properties. Create theme presets and a theme picker for switching themes at runtime.
</Prompt>

<Steps>
<Step title="Understand theme variables">

Chat components use CSS custom properties for visual styling:

```css
--ngaf-chat-bg: #171717;
--ngaf-chat-text: #e0e0e0;
--ngaf-chat-accent: #3b82f6;
--ngaf-chat-surface-alt: #222;
--ngaf-chat-separator: #333;
--ngaf-chat-text-muted: #777;
```

</Step>
<Step title="Create theme presets">

Define theme presets as objects mapping CSS custom properties:

```typescript
const themes = {
  dark: {
    '--ngaf-chat-bg': '#171717',
    '--ngaf-chat-text': '#e0e0e0',
  },
  light: {
    '--ngaf-chat-bg': '#ffffff',
    '--ngaf-chat-text': '#1a1a1a',
  },
  ocean: {
    '--ngaf-chat-bg': '#0c1426',
    '--ngaf-chat-text': '#c8d6e5',
  },
};
```

</Step>
<Step title="Build a theme picker">

Create controls that swap CSS variables on the document root or a chat container:

```typescript
setTheme(name: string) {
  const theme = this.themes[name];
  Object.entries(theme).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
}
```

</Step>
<Step title="Customize per component">

Override specific component styles without affecting the global theme:

```css
chat-input {
  --ngaf-chat-input-bg: #1a1a2e;
}
```

</Step>
</Steps>

<Tip>
Chat components provide sensible defaults. Override only the `--ngaf-chat-*` properties you need to change for your brand.
</Tip>
