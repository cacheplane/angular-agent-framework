// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { InjectionToken } from '@angular/core';

export interface RepeatScope {
  item: unknown;
  index: number;
  basePath: string;
}

export const REPEAT_SCOPE = new InjectionToken<RepeatScope>('REPEAT_SCOPE');
