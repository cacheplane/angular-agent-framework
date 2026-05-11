// libs/chat/src/lib/primitives/chat-message/chat-message.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ChatMessageComponent } from './chat-message.component';
import { CitationsResolverService } from '../../markdown/citations-resolver.service';

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
