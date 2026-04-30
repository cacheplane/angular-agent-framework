// SPDX-License-Identifier: MIT
import { InjectionToken } from '@angular/core';

export interface RepeatScope {
  item: unknown;
  index: number;
  basePath: string;
}

export const REPEAT_SCOPE = new InjectionToken<RepeatScope>('REPEAT_SCOPE');
