// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createStreamingMarkdownRenderer,
  type StreamingMarkdownRenderer,
} from './streaming-markdown';

describe('StreamingMarkdownRenderer', () => {
  let renderer: StreamingMarkdownRenderer;

  beforeEach(() => {
    renderer = createStreamingMarkdownRenderer();
  });

  describe('container', () => {
    it('should have class chat-md', () => {
      expect(renderer.container.className).toBe('chat-md');
    });

    it('should be a div element', () => {
      expect(renderer.container.tagName).toBe('DIV');
    });
  });

  describe('plain text renders as paragraph', () => {
    it('should wrap plain text in a <p> tag', () => {
      renderer.push('Hello world');
      renderer.finish();
      const p = renderer.container.querySelector('p');
      expect(p).not.toBeNull();
      expect(p!.textContent).toBe('Hello world');
    });

    it('should create separate paragraphs for text separated by blank lines', () => {
      renderer.push('First paragraph\n\nSecond paragraph');
      renderer.finish();
      const paragraphs = renderer.container.querySelectorAll('p');
      expect(paragraphs).toHaveLength(2);
      expect(paragraphs[0].textContent).toBe('First paragraph');
      expect(paragraphs[1].textContent).toBe('Second paragraph');
    });

    it('should join consecutive non-blank lines in the same paragraph', () => {
      renderer.push('Line one\nLine two');
      renderer.finish();
      const paragraphs = renderer.container.querySelectorAll('p');
      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0].textContent).toBe('Line one Line two');
    });
  });

  describe('bold and italic inline formatting', () => {
    it('should render **text** as <strong>', () => {
      renderer.push('This is **bold** text');
      renderer.finish();
      const strong = renderer.container.querySelector('strong');
      expect(strong).not.toBeNull();
      expect(strong!.textContent).toBe('bold');
    });

    it('should render *text* as <em>', () => {
      renderer.push('This is *italic* text');
      renderer.finish();
      const em = renderer.container.querySelector('em');
      expect(em).not.toBeNull();
      expect(em!.textContent).toBe('italic');
    });

    it('should handle bold and italic in the same line', () => {
      renderer.push('**bold** and *italic*');
      renderer.finish();
      expect(renderer.container.querySelector('strong')!.textContent).toBe('bold');
      expect(renderer.container.querySelector('em')!.textContent).toBe('italic');
    });

    it('should handle nested bold inside text', () => {
      renderer.push('Start **middle** end');
      renderer.finish();
      const p = renderer.container.querySelector('p')!;
      expect(p.innerHTML).toBe('Start <strong>middle</strong> end');
    });
  });

  describe('headers (h1-h4)', () => {
    it('should render # as h1', () => {
      renderer.push('# Heading 1');
      renderer.finish();
      const h1 = renderer.container.querySelector('h1');
      expect(h1).not.toBeNull();
      expect(h1!.textContent).toBe('Heading 1');
    });

    it('should render ## as h2', () => {
      renderer.push('## Heading 2');
      renderer.finish();
      const h2 = renderer.container.querySelector('h2');
      expect(h2).not.toBeNull();
      expect(h2!.textContent).toBe('Heading 2');
    });

    it('should render ### as h3', () => {
      renderer.push('### Heading 3');
      renderer.finish();
      const h3 = renderer.container.querySelector('h3');
      expect(h3).not.toBeNull();
      expect(h3!.textContent).toBe('Heading 3');
    });

    it('should render #### as h4', () => {
      renderer.push('#### Heading 4');
      renderer.finish();
      const h4 = renderer.container.querySelector('h4');
      expect(h4).not.toBeNull();
      expect(h4!.textContent).toBe('Heading 4');
    });

    it('should support inline formatting in headers', () => {
      renderer.push('## A **bold** heading');
      renderer.finish();
      const h2 = renderer.container.querySelector('h2')!;
      expect(h2.querySelector('strong')!.textContent).toBe('bold');
    });
  });

  describe('unordered and ordered lists', () => {
    it('should render - items as <ul><li>', () => {
      renderer.push('- Item 1\n- Item 2\n- Item 3');
      renderer.finish();
      const ul = renderer.container.querySelector('ul');
      expect(ul).not.toBeNull();
      const items = ul!.querySelectorAll('li');
      expect(items).toHaveLength(3);
      expect(items[0].textContent).toBe('Item 1');
      expect(items[1].textContent).toBe('Item 2');
      expect(items[2].textContent).toBe('Item 3');
    });

    it('should render * items as <ul><li>', () => {
      renderer.push('* Alpha\n* Beta');
      renderer.finish();
      const ul = renderer.container.querySelector('ul');
      expect(ul).not.toBeNull();
      expect(ul!.querySelectorAll('li')).toHaveLength(2);
    });

    it('should render numbered items as <ol><li>', () => {
      renderer.push('1. First\n2. Second\n3. Third');
      renderer.finish();
      const ol = renderer.container.querySelector('ol');
      expect(ol).not.toBeNull();
      const items = ol!.querySelectorAll('li');
      expect(items).toHaveLength(3);
      expect(items[0].textContent).toBe('First');
    });

    it('should keep consecutive list items in one <ul>', () => {
      renderer.push('- A\n- B\n- C');
      renderer.finish();
      const lists = renderer.container.querySelectorAll('ul');
      expect(lists).toHaveLength(1);
    });

    it('should support inline formatting in list items', () => {
      renderer.push('- **Bold item**\n- *Italic item*');
      renderer.finish();
      const items = renderer.container.querySelectorAll('li');
      expect(items[0].querySelector('strong')!.textContent).toBe('Bold item');
      expect(items[1].querySelector('em')!.textContent).toBe('Italic item');
    });
  });

  describe('fenced code blocks', () => {
    it('should buffer code blocks until closing fence', () => {
      renderer.push('```\nconst x = 1;\nconst y = 2;\n```');
      renderer.finish();
      const pre = renderer.container.querySelector('pre');
      expect(pre).not.toBeNull();
      const code = pre!.querySelector('code');
      expect(code).not.toBeNull();
      expect(code!.textContent).toBe('const x = 1;\nconst y = 2;');
    });

    it('should set language class when specified', () => {
      renderer.push('```typescript\nconst x: number = 1;\n```');
      renderer.finish();
      const code = renderer.container.querySelector('code');
      expect(code!.className).toBe('language-typescript');
    });

    it('should not render code block content until fence is closed', () => {
      renderer.push('```\nline 1\nline 2');
      // No closing fence yet — code block should not appear
      expect(renderer.container.querySelector('pre')).toBeNull();
      renderer.push('\n```');
      renderer.finish();
      expect(renderer.container.querySelector('pre')).not.toBeNull();
    });

    it('should handle code blocks streamed character by character', () => {
      const input = '```js\nalert("hi");\n```\n';
      for (const ch of input) {
        renderer.push(ch);
      }
      renderer.finish();
      const code = renderer.container.querySelector('code');
      expect(code).not.toBeNull();
      expect(code!.textContent).toBe('alert("hi");');
      expect(code!.className).toBe('language-js');
    });
  });

  describe('mixed content (paragraph, list, paragraph)', () => {
    it('should handle transitions between block types', () => {
      renderer.push('Some intro text.\n\n- Item A\n- Item B\n\nClosing text.');
      renderer.finish();

      const children = renderer.container.children;
      expect(children[0].tagName).toBe('P');
      expect(children[0].textContent).toBe('Some intro text.');
      expect(children[1].tagName).toBe('UL');
      expect(children[1].querySelectorAll('li')).toHaveLength(2);
      expect(children[2].tagName).toBe('P');
      expect(children[2].textContent).toBe('Closing text.');
    });

    it('should handle heading followed by paragraph followed by list', () => {
      renderer.push('# Title\n\nA paragraph.\n\n- One\n- Two');
      renderer.finish();

      const children = renderer.container.children;
      expect(children[0].tagName).toBe('H1');
      expect(children[1].tagName).toBe('P');
      expect(children[2].tagName).toBe('UL');
    });
  });

  describe('streaming simulation', () => {
    it('should produce same output when pushed one char at a time vs all at once', () => {
      const input = '# Hello\n\nThis is **bold** and *italic*.\n\n- Item 1\n- Item 2\n\n```js\nconst x = 1;\n```\n';

      // Render all at once
      const allAtOnce = createStreamingMarkdownRenderer();
      allAtOnce.push(input);
      allAtOnce.finish();

      // Render one char at a time
      const charByChar = createStreamingMarkdownRenderer();
      for (const ch of input) {
        charByChar.push(ch);
      }
      charByChar.finish();

      expect(charByChar.container.innerHTML).toBe(allAtOnce.container.innerHTML);
    });

    it('should produce same output when pushed in random chunks', () => {
      const input = '## Sub-heading\n\nSome text with `inline code` here.\n\n1. First\n2. Second\n';

      const allAtOnce = createStreamingMarkdownRenderer();
      allAtOnce.push(input);
      allAtOnce.finish();

      // Push in chunks of varying sizes
      const chunked = createStreamingMarkdownRenderer();
      let pos = 0;
      const chunkSizes = [3, 7, 1, 12, 5, 2, 8, 4, 100];
      for (const size of chunkSizes) {
        if (pos >= input.length) break;
        chunked.push(input.slice(pos, pos + size));
        pos += size;
      }
      if (pos < input.length) {
        chunked.push(input.slice(pos));
      }
      chunked.finish();

      expect(chunked.container.innerHTML).toBe(allAtOnce.container.innerHTML);
    });
  });

  describe('links render as anchor tags', () => {
    it('should render [text](url) as <a>', () => {
      renderer.push('Visit [Google](https://google.com) today');
      renderer.finish();
      const a = renderer.container.querySelector('a');
      expect(a).not.toBeNull();
      expect(a!.textContent).toBe('Google');
      expect(a!.href).toBe('https://google.com/');
    });

    it('should handle multiple links in one line', () => {
      renderer.push('[A](https://a.com) and [B](https://b.com)');
      renderer.finish();
      const links = renderer.container.querySelectorAll('a');
      expect(links).toHaveLength(2);
      expect(links[0].textContent).toBe('A');
      expect(links[1].textContent).toBe('B');
    });
  });

  describe('blockquotes', () => {
    it('should render > text as <blockquote>', () => {
      renderer.push('> This is a quote');
      renderer.finish();
      const bq = renderer.container.querySelector('blockquote');
      expect(bq).not.toBeNull();
      expect(bq!.textContent).toBe('This is a quote');
    });

    it('should group consecutive blockquote lines', () => {
      renderer.push('> Line one\n> Line two');
      renderer.finish();
      const bqs = renderer.container.querySelectorAll('blockquote');
      expect(bqs).toHaveLength(1);
      const paragraphs = bqs[0].querySelectorAll('p');
      expect(paragraphs).toHaveLength(2);
    });

    it('should support inline formatting inside blockquotes', () => {
      renderer.push('> This is **important**');
      renderer.finish();
      const strong = renderer.container.querySelector('blockquote strong');
      expect(strong).not.toBeNull();
      expect(strong!.textContent).toBe('important');
    });
  });

  describe('inline code', () => {
    it('should render `text` as <code>', () => {
      renderer.push('Use the `forEach` method');
      renderer.finish();
      const code = renderer.container.querySelector('code');
      expect(code).not.toBeNull();
      expect(code!.textContent).toBe('forEach');
    });

    it('should handle multiple inline code spans', () => {
      renderer.push('`a` and `b` and `c`');
      renderer.finish();
      const codes = renderer.container.querySelectorAll('code');
      expect(codes).toHaveLength(3);
      expect(codes[0].textContent).toBe('a');
      expect(codes[1].textContent).toBe('b');
      expect(codes[2].textContent).toBe('c');
    });
  });

  describe('tables', () => {
    it('should render a simple table', () => {
      renderer.push('| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |');
      renderer.finish();
      const table = renderer.container.querySelector('table');
      expect(table).not.toBeNull();
      const ths = table!.querySelectorAll('th');
      expect(ths).toHaveLength(2);
      expect(ths[0].textContent).toBe('Name');
      expect(ths[1].textContent).toBe('Age');
      const tds = table!.querySelectorAll('td');
      expect(tds).toHaveLength(4);
      expect(tds[0].textContent).toBe('Alice');
    });

    it('should handle column alignment', () => {
      renderer.push('| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |');
      renderer.finish();
      const ths = renderer.container.querySelectorAll('th');
      expect(ths[0].style.textAlign).toBe('left');
      expect(ths[1].style.textAlign).toBe('center');
      expect(ths[2].style.textAlign).toBe('right');
    });
  });

  describe('reset', () => {
    it('should clear the container and all state', () => {
      renderer.push('# Hello\n\nSome text');
      renderer.finish();
      expect(renderer.container.children.length).toBeGreaterThan(0);

      renderer.reset();
      expect(renderer.container.children.length).toBe(0);
      expect(renderer.container.innerHTML).toBe('');

      // Should work correctly after reset
      renderer.push('New content');
      renderer.finish();
      expect(renderer.container.querySelector('p')!.textContent).toBe('New content');
    });
  });

  describe('finish', () => {
    it('should flush buffered content without trailing newline', () => {
      renderer.push('No trailing newline');
      renderer.finish();
      expect(renderer.container.querySelector('p')!.textContent).toBe('No trailing newline');
    });

    it('should close unclosed code blocks on finish', () => {
      renderer.push('```\nunclosed code');
      renderer.finish();
      const pre = renderer.container.querySelector('pre');
      expect(pre).not.toBeNull();
      expect(pre!.querySelector('code')!.textContent).toBe('unclosed code');
    });
  });
});
