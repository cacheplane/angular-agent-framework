// SPDX-License-Identifier: MIT
declare const NGAF_CHAT_DEBUG: boolean;
declare const ngDevMode: boolean;

export const CHAT_DEBUG_INCLUDED =
  ngDevMode ||
  (typeof NGAF_CHAT_DEBUG !== 'undefined' && NGAF_CHAT_DEBUG === true);
