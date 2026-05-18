// SPDX-License-Identifier: MIT
export { startAimock, type AimockHandle, type AimockStartOptions } from './aimock-runner';
export {
  sendPromptAndWait,
  sendPromptAndWaitForInterrupt,
  clickInterruptActionAndWaitFinal,
  type SendPromptAndWaitOptions,
} from './test-helpers';
export { createGlobalSetup, type CreateGlobalSetupOpts } from './global-setup-factory';
