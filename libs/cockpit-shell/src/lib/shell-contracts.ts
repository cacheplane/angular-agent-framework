export const COCKPIT_SHELL_ROUTE_IDS = ['home', 'docs', 'workspace'] as const;

export type CockpitShellRouteId = (typeof COCKPIT_SHELL_ROUTE_IDS)[number];

export interface CockpitShellRouteDefinition {
  id: CockpitShellRouteId;
  path: `/${string}`;
  title: string;
  description: string;
}

export interface CockpitShellRouteGroup {
  name: string;
  routes: readonly CockpitShellRouteDefinition[];
}

export const COCKPIT_SHELL_ROUTE_CONTRACT_HOME: CockpitShellRouteGroup = {
  name: 'cockpit-shell-route-contracts',
  routes: [],
};
