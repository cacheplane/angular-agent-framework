import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideAgent, STREAM_RESOURCE_CONFIG } from './agent.provider';
import { MockAgentTransport } from './transport/mock-stream.transport';

describe('provideAgent', () => {
  it('provides STREAM_RESOURCE_CONFIG token', () => {
    TestBed.configureTestingModule({
      providers: [provideAgent({ apiUrl: 'https://api.example.com' })],
    });
    const config = TestBed.inject(STREAM_RESOURCE_CONFIG);
    expect(config.apiUrl).toBe('https://api.example.com');
  });

  it('provides custom transport via config', () => {
    const transport = new MockAgentTransport();
    TestBed.configureTestingModule({
      providers: [provideAgent({ apiUrl: '', transport })],
    });
    const config = TestBed.inject(STREAM_RESOURCE_CONFIG);
    expect(config.transport).toBe(transport);
  });
});
