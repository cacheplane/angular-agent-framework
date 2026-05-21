// SPDX-License-Identifier: MIT
import { Routes } from '@angular/router';

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
        path: 'popup',
        loadComponent: () =>
          import('./modes/popup-mode.component').then((m) => m.PopupMode),
      },
      {
        path: 'sidebar',
        loadComponent: () =>
          import('./modes/sidebar-mode.component').then((m) => m.SidebarMode),
      },
    ],
  },
  { path: '**', redirectTo: 'embed' },
];
