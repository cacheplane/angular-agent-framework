// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { ChatToolCallCardComponent } from './chat-tool-call-card.component';
import type { ToolCallInfo } from './chat-tool-call-card.component';

describe('ChatToolCallCardComponent', () => {
  it('is defined', () => {
    expect(ChatToolCallCardComponent).toBeDefined();
    expect(typeof ChatToolCallCardComponent).toBe('function');
  });

  it('formatJson returns string values as-is', () => {
    const formatJson = ChatToolCallCardComponent.prototype.formatJson;
    expect(formatJson('hello')).toBe('hello');
  });

  it('formatJson serializes objects to indented JSON', () => {
    const formatJson = ChatToolCallCardComponent.prototype.formatJson;
    const result = formatJson({ key: 'value' });
    expect(result).toContain('"key"');
    expect(result).toContain('"value"');
  });

  it('formatJson handles null gracefully', () => {
    const formatJson = ChatToolCallCardComponent.prototype.formatJson;
    const result = formatJson(null);
    expect(result).toBe('null');
  });

  it('ToolCallInfo type has required fields', () => {
    const info: ToolCallInfo = { id: '1', name: 'myTool', args: { x: 1 } };
    expect(info.id).toBe('1');
    expect(info.name).toBe('myTool');
  });
});
