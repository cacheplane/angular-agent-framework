// SPDX-License-Identifier: MIT
export type CockpitEventName =
  | 'cockpit:recipe_opened'
  | 'cockpit:mode_switched'
  | 'cockpit:code_copied'
  | 'cockpit:chat_first_message'
  | 'cockpit:transport_connected'
  | 'cockpit:thread_persisted'
  | 'cockpit:interrupt_handled'
  | 'cockpit:generative_component_rendered'
  | 'cockpit:activation_complete';
