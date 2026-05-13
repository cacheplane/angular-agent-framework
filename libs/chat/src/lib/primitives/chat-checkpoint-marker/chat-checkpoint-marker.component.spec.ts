// libs/chat/src/lib/primitives/chat-checkpoint-marker/chat-checkpoint-marker.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ChatCheckpointMarkerComponent } from './chat-checkpoint-marker.component';

@Component({
  standalone: true,
  imports: [ChatCheckpointMarkerComponent],
  template: `<chat-checkpoint-marker
    [checkpointId]="cpId"
    [isActive]="active"
    (replayRequested)="onReplay($event)"
    (forkRequested)="onFork($event)" />`,
})
class HostComponent {
  cpId = 'cp-1';
  active = false;
  replayed: string[] = [];
  forked: string[] = [];
  onReplay(id: string): void { this.replayed.push(id); }
  onFork(id: string): void { this.forked.push(id); }
}

describe('ChatCheckpointMarkerComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [HostComponent] }));

  it('renders a dot button labelled with the checkpoint id', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    const dot = fx.nativeElement.querySelector('.chat-checkpoint-marker__dot') as HTMLButtonElement;
    expect(dot).toBeTruthy();
    expect(dot.getAttribute('aria-label')).toContain('cp-1');
  });

  it('applies the active class when isActive=true', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.componentInstance.active = true;
    fx.detectChanges();
    const dot = fx.nativeElement.querySelector('.chat-checkpoint-marker__dot');
    expect(dot.getAttribute('data-active')).toBe('true');
  });

  it('emits replayRequested with the checkpointId when Rewind is clicked', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    (fx.nativeElement.querySelector('[data-action="rewind"]') as HTMLButtonElement).click();
    expect(fx.componentInstance.replayed).toEqual(['cp-1']);
  });

  it('emits forkRequested with the checkpointId when Fork is clicked', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    (fx.nativeElement.querySelector('[data-action="fork"]') as HTMLButtonElement).click();
    expect(fx.componentInstance.forked).toEqual(['cp-1']);
  });

  it('positions the host as a containing block so the hover pill anchors to the dot', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    const host = fx.nativeElement.querySelector('chat-checkpoint-marker') as HTMLElement;
    expect(getComputedStyle(host).position).toBe('relative');
  });
});
