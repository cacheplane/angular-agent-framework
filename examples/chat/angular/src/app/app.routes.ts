// SPDX-License-Identifier: MIT
import { Routes, UrlMatcher, UrlMatchResult, UrlSegment } from '@angular/router';

/** Matcher factory: collapses `<mode>` and `<mode>/<threadId>` into a
 *  single route entry. Two separate route entries (`embed` + `embed/:threadId`)
 *  cause Angular to tear down + remount the mode component when navigating
 *  from one to the other — which, post-PR-#500, was killing the in-flight
 *  stream when the agent auto-created a thread mid-send and our
 *  signal→URL effect navigated `/embed` → `/embed/<new-id>`.
 *
 *  This matcher recognises both URL shapes as the same route, so the
 *  component instance survives the navigation.
 *
 *  Exported `posParams.threadId` is consumable via ActivatedRoute /
 *  router.firstChild.paramMap if a consumer ever needs it; DemoShell
 *  itself reads from `router.url` via `parseUrl()` and doesn't depend
 *  on the param being plumbed through ActivatedRoute. */
function modeMatcher(modeName: string): UrlMatcher {
  return (segments: UrlSegment[]): UrlMatchResult | null => {
    if (segments.length === 0) return null;
    if (segments[0].path !== modeName) return null;
    if (segments.length === 1) {
      return { consumed: segments, posParams: {} };
    }
    if (segments.length === 2) {
      return { consumed: segments, posParams: { threadId: segments[1] } };
    }
    return null;
  };
}

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'embed' },
  {
    path: '',
    loadComponent: () =>
      import('./shell/demo-shell.component').then((m) => m.DemoShell),
    children: [
      {
        matcher: modeMatcher('embed'),
        loadComponent: () =>
          import('./modes/embed-mode.component').then((m) => m.EmbedMode),
      },
      {
        matcher: modeMatcher('popup'),
        loadComponent: () =>
          import('./modes/popup-mode.component').then((m) => m.PopupMode),
      },
      {
        matcher: modeMatcher('sidebar'),
        loadComponent: () =>
          import('./modes/sidebar-mode.component').then((m) => m.SidebarMode),
      },
    ],
  },
  { path: '**', redirectTo: 'embed' },
];
