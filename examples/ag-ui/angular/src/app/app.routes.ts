// SPDX-License-Identifier: MIT
import { Routes } from '@angular/router';
import { EmbedMode } from './modes/embed-mode.component';
import { PopupMode } from './modes/popup-mode.component';
import { SidebarMode } from './modes/sidebar-mode.component';

export const routes: Routes = [
  { path: 'embed', component: EmbedMode },
  { path: 'popup', component: PopupMode },
  { path: 'sidebar', component: SidebarMode },
  { path: '', pathMatch: 'full', redirectTo: 'embed' },
  { path: '**', redirectTo: 'embed' },
];
