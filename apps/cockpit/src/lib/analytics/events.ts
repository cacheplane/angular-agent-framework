// SPDX-License-Identifier: MIT
export type CockpitShellEvent =
  | 'cockpit:recipe_opened'
  | 'cockpit:mode_switched'
  | 'cockpit:code_copied';

export interface CockpitShellProps {
  capability?: string;
  category?: string;
  from_capability?: string;
  from_mode?: 'run' | 'code' | 'docs' | 'api';
  to_mode?: 'run' | 'code' | 'docs' | 'api';
  surface?: 'code_mode' | 'docs_code_snippet' | 'agentic_prompt';
  file_path?: string;
}
