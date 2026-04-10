import { Component } from '@angular/core';

@Component({
  selector: 'example-split-layout',
  standalone: true,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      height: 100dvh;
      background: rgb(3 7 18);
      color: rgb(243 244 246);
    }
  `,
  template: `
    <div class="shrink-0 border-b border-gray-800">
      <ng-content select="[header]" />
    </div>

    <div class="flex flex-col md:flex-row flex-1 min-h-0">
      <div class="flex-1 overflow-y-auto p-4 md:p-6 min-h-[200px] md:min-h-0">
        <ng-content select="[primary]" />
      </div>
      <div class="w-full md:w-80 shrink-0 flex flex-col border-t md:border-t-0 md:border-l border-gray-800 bg-gray-900/50">
        <ng-content select="[secondary]" />
      </div>
    </div>

    <div class="shrink-0">
      <ng-content select="[footer]" />
    </div>
  `,
})
export class ExampleSplitLayoutComponent {}
