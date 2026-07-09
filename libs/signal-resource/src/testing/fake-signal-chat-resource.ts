// SPDX-License-Identifier: MIT
import { signal, type Signal, type WritableSignal } from '@angular/core';
import type {
  SignalChatResourceLike,
  SignalChatResourceMessage,
} from '../lib/to-agent';

export interface FakeSignalChatResource extends SignalChatResourceLike {
  value: Signal<SignalChatResourceMessage[]>;
  isLoading: Signal<boolean>;
  error: Signal<Error | undefined>;
}

export interface FakeSignalChatResourceFixture {
  resource: FakeSignalChatResource;
  messages: WritableSignal<SignalChatResourceMessage[]>;
  isLoading: WritableSignal<boolean>;
  error: WritableSignal<Error | undefined>;
  sent: Array<{ role: 'user'; content: unknown }>;
  setMessagesCalls: SignalChatResourceMessage[][];
  stopCount: number;
  resendCount: number;
  reloadCount: number;
}

export interface FakeSignalChatResourceOptions {
  messages?: SignalChatResourceMessage[];
  isLoading?: boolean;
  error?: Error;
  withResend?: boolean;
  withReload?: boolean;
}

export function makeFakeSignalChatResource(
  options: FakeSignalChatResourceOptions = {},
): FakeSignalChatResourceFixture {
  const messages = signal<SignalChatResourceMessage[]>(options.messages ?? []);
  const isLoading = signal(options.isLoading ?? false);
  const error = signal<Error | undefined>(options.error);
  const sent: Array<{ role: 'user'; content: unknown }> = [];
  const setMessagesCalls: SignalChatResourceMessage[][] = [];
  let stopCount = 0;
  let resendCount = 0;
  let reloadCount = 0;

  const resource: FakeSignalChatResource = {
    value: messages.asReadonly(),
    isLoading: isLoading.asReadonly(),
    error: error.asReadonly(),
    sendMessage: (message) => {
      sent.push(message);
      messages.update((prev) => [...prev, message]);
    },
    stop: () => {
      if (!isLoading()) throw new Error('Cannot stop when idle');
      stopCount++;
      isLoading.set(false);
    },
    setMessages: (next) => {
      setMessagesCalls.push(next);
      messages.set(next);
    },
    ...(options.withResend
      ? {
          resendMessages: () => {
            resendCount++;
          },
        }
      : {}),
    ...(options.withReload
      ? {
          reload: () => {
            reloadCount++;
            return true;
          },
        }
      : {}),
  };

  return {
    resource,
    messages,
    isLoading,
    error,
    sent,
    setMessagesCalls,
    get stopCount() {
      return stopCount;
    },
    get resendCount() {
      return resendCount;
    },
    get reloadCount() {
      return reloadCount;
    },
  };
}
