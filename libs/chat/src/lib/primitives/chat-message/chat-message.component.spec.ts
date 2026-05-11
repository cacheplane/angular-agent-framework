// libs/chat/src/lib/primitives/chat-message/chat-message.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ChatMessageComponent } from './chat-message.component';
import { CitationsResolverService } from '../../markdown/citations-resolver.service';
import type { Message } from '../../agent/message';

describe('ChatMessageComponent', () => {
  it('instantiates without error', () => {
    TestBed.configureTestingModule({ providers: [CitationsResolverService] });
    let component!: ChatMessageComponent;
    TestBed.runInInjectionContext(() => {
      component = new ChatMessageComponent();
    });
    expect(component).toBeTruthy();
  });
});

@Component({
  standalone: true,
  imports: [ChatMessageComponent],
  template: `<chat-message
    role="assistant"
    [checkpointId]="cpId"
    (replayRequested)="replayed.push($event)"
    (forkRequested)="forked.push($event)">Hello</chat-message>`,
})
class GutterHost {
  cpId: string | undefined = undefined;
  replayed: string[] = [];
  forked: string[] = [];
}

describe('ChatMessageComponent — gutter checkpoint marker', () => {
  it('does not render a marker when checkpointId is unset', () => {
    TestBed.configureTestingModule({ imports: [GutterHost] });
    const fx = TestBed.createComponent(GutterHost);
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('chat-checkpoint-marker')).toBeNull();
  });

  it('renders a marker in the gutter when checkpointId is set', () => {
    TestBed.configureTestingModule({ imports: [GutterHost] });
    const fx = TestBed.createComponent(GutterHost);
    fx.componentInstance.cpId = 'cp-99';
    fx.detectChanges();
    const marker = fx.nativeElement.querySelector('chat-checkpoint-marker');
    expect(marker).toBeTruthy();
    expect(marker.querySelector('[aria-label]').getAttribute('aria-label')).toContain('cp-99');
  });

  it('bubbles replayRequested from the marker as a message-level output', () => {
    TestBed.configureTestingModule({ imports: [GutterHost] });
    const fx = TestBed.createComponent(GutterHost);
    fx.componentInstance.cpId = 'cp-99';
    fx.detectChanges();
    (fx.nativeElement.querySelector('[data-action="rewind"]') as HTMLButtonElement).click();
    expect(fx.componentInstance.replayed).toEqual(['cp-99']);
  });

  it('bubbles forkRequested from the marker as a message-level output', () => {
    TestBed.configureTestingModule({ imports: [GutterHost] });
    const fx = TestBed.createComponent(GutterHost);
    fx.componentInstance.cpId = 'cp-99';
    fx.detectChanges();
    (fx.nativeElement.querySelector('[data-action="fork"]') as HTMLButtonElement).click();
    expect(fx.componentInstance.forked).toEqual(['cp-99']);
  });
});

@Component({
  standalone: true,
  imports: [ChatMessageComponent],
  template: `<chat-message
    role="assistant"
    [message]="msg"
    [streaming]="streaming"
  >Streaming body</chat-message>`,
})
class GenuiHost {
  msg: Message | undefined = undefined;
  streaming = false;
}

function makeMessage(toolCalls: Array<{ name: string; id?: string }>): Message {
  return {
    id: 'm-1',
    role: 'assistant',
    content: '',
    extra: { tool_calls: toolCalls },
  };
}

describe('ChatMessageComponent — GenUI tool-call suppression', () => {
  it('renders the skeleton when message has a generate_a2ui_schema tool call and is streaming', () => {
    TestBed.configureTestingModule({ imports: [GenuiHost] });
    const fx = TestBed.createComponent(GenuiHost);
    fx.componentInstance.msg = makeMessage([{ name: 'generate_a2ui_schema' }]);
    fx.componentInstance.streaming = true;
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('chat-genui-skeleton')).toBeTruthy();
    expect(fx.nativeElement.querySelector('.chat-message__assistant-body')).toBeNull();
  });

  it('renders the skeleton when message has a generate_json_render_spec tool call', () => {
    TestBed.configureTestingModule({ imports: [GenuiHost] });
    const fx = TestBed.createComponent(GenuiHost);
    fx.componentInstance.msg = makeMessage([{ name: 'generate_json_render_spec' }]);
    fx.componentInstance.streaming = true;
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('chat-genui-skeleton')).toBeTruthy();
  });

  it('keeps the skeleton after streaming completes (body remains suppressed)', () => {
    TestBed.configureTestingModule({ imports: [GenuiHost] });
    const fx = TestBed.createComponent(GenuiHost);
    fx.componentInstance.msg = makeMessage([{ name: 'generate_a2ui_schema' }]);
    fx.componentInstance.streaming = false;
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('chat-genui-skeleton')).toBeTruthy();
  });

  it('renders the normal body when tool call is a non-GenUI tool (e.g. search_documents)', () => {
    TestBed.configureTestingModule({ imports: [GenuiHost] });
    const fx = TestBed.createComponent(GenuiHost);
    fx.componentInstance.msg = makeMessage([{ name: 'search_documents' }]);
    fx.componentInstance.streaming = true;
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('chat-genui-skeleton')).toBeNull();
    expect(fx.nativeElement.querySelector('.chat-message__assistant-body')).toBeTruthy();
  });

  it('renders the normal body when message has no tool calls', () => {
    TestBed.configureTestingModule({ imports: [GenuiHost] });
    const fx = TestBed.createComponent(GenuiHost);
    fx.componentInstance.msg = { id: 'm-1', role: 'assistant', content: 'hi', extra: {} };
    fx.componentInstance.streaming = false;
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('chat-genui-skeleton')).toBeNull();
    expect(fx.nativeElement.querySelector('.chat-message__assistant-body')).toBeTruthy();
  });

  it('detects function_call content block during streaming (before tool_calls populates)', () => {
    TestBed.configureTestingModule({ imports: [GenuiHost] });
    const fx = TestBed.createComponent(GenuiHost);
    // Mid-stream OpenAI Responses-API shape: tool_calls is still empty but
    // the content array carries the function_call block with the tool name.
    fx.componentInstance.msg = {
      id: 'm-1',
      role: 'assistant',
      content: '',
      extra: {
        tool_calls: [],
        content: [
          { type: 'reasoning', summary: [] },
          { type: 'function_call', name: 'generate_a2ui_schema', arguments: '{"req' },
        ],
      },
    };
    fx.componentInstance.streaming = true;
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('chat-genui-skeleton')).toBeTruthy();
  });

  it('detects A2UI sentinel prefix on the emit-phase message', () => {
    TestBed.configureTestingModule({ imports: [GenuiHost] });
    const fx = TestBed.createComponent(GenuiHost);
    fx.componentInstance.msg = {
      id: 'm-1',
      role: 'assistant',
      content: '---a2ui_JSON---\n{"surfaceUpdate":{"surfaceId":"main"}}',
      extra: {},
    };
    fx.componentInstance.streaming = true;
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('chat-genui-skeleton')).toBeTruthy();
  });

  it('detects PARTIAL A2UI sentinel during the first streaming chunks', () => {
    TestBed.configureTestingModule({ imports: [GenuiHost] });
    const fx = TestBed.createComponent(GenuiHost);
    // After only a few tokens have arrived, content is a prefix of the sentinel.
    fx.componentInstance.msg = {
      id: 'm-1',
      role: 'assistant',
      content: '---a',
      extra: {},
    };
    fx.componentInstance.streaming = true;
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('chat-genui-skeleton')).toBeTruthy();
  });

  it('does not match an unrelated assistant message that happens to start with dashes', () => {
    TestBed.configureTestingModule({ imports: [GenuiHost] });
    const fx = TestBed.createComponent(GenuiHost);
    fx.componentInstance.msg = {
      id: 'm-1',
      role: 'assistant',
      content: '---some-other-marker---',
      extra: {},
    };
    fx.componentInstance.streaming = false;
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('chat-genui-skeleton')).toBeNull();
  });
});
