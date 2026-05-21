// SPDX-License-Identifier: MIT
import { Routes } from '@angular/router';

// Each mode gets two route entries: a stateless `<mode>` and a
// thread-scoped `<mode>/:threadId`. Angular Router doesn't support
// `?`-style optional params, hence the duplication. DemoShell's
// URL ↔ signal sync (see spec 2026-05-20-url-thread-routing-design.md)
// reads `route.firstChild.paramMap.threadId` so both shapes feed the
// same handler.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'embed' },
  {
    path: '',
    loadComponent: () =>
      import('./shell/demo-shell.component').then((m) => m.DemoShell),
    children: [
      {
        path: 'embed',
        loadComponent: () =>
          import('./modes/embed-mode.component').then((m) => m.EmbedMode),
      },
      {
        path: 'embed/:threadId',
        loadComponent: () =>
          import('./modes/embed-mode.component').then((m) => m.EmbedMode),
      },
      {
        path: 'popup',
        loadComponent: () =>
          import('./modes/popup-mode.component').then((m) => m.PopupMode),
      },
      {
        path: 'popup/:threadId',
        loadComponent: () =>
          import('./modes/popup-mode.component').then((m) => m.PopupMode),
      },
      {
        path: 'sidebar',
        loadComponent: () =>
          import('./modes/sidebar-mode.component').then((m) => m.SidebarMode),
      },
      {
        path: 'sidebar/:threadId',
        loadComponent: () =>
          import('./modes/sidebar-mode.component').then((m) => m.SidebarMode),
      },
    ],
  },
  { path: '**', redirectTo: 'embed' },
];
