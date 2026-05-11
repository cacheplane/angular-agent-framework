// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { ChatDebugSectionComponent } from './chat-debug-section.component';
import { ChatDebugSegmentedComponent } from './chat-debug-segmented.component';
import { ChatDebugSelectComponent } from './chat-debug-select.component';
import { ChatDebugSwitchComponent } from './chat-debug-switch.component';
import { ChatDebugActionComponent } from './chat-debug-action.component';

describe('chat-debug primitives are defined', () => {
  it('section', () => { expect(typeof ChatDebugSectionComponent).toBe('function'); });
  it('segmented', () => { expect(typeof ChatDebugSegmentedComponent).toBe('function'); });
  it('select', () => { expect(typeof ChatDebugSelectComponent).toBe('function'); });
  it('switch', () => { expect(typeof ChatDebugSwitchComponent).toBe('function'); });
  it('action', () => { expect(typeof ChatDebugActionComponent).toBe('function'); });
});
