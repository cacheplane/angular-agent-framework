import { Component, computed } from '@angular/core';
import { ChatComponent, views } from '@cacheplane/chat';
import { signalStateStore } from '@cacheplane/render';
import { agent } from '@cacheplane/angular';
import { environment } from '../environments/environment';
import { FilePreviewComponent } from './views/file-preview.component';

/**
 * Represents a file operation extracted from agent tool calls.
 */
interface FileOperation {
  type: 'read' | 'write';
  path: string;
  preview: string;
}

/**
 * FilesystemComponent demonstrates agent file operations.
 *
 * The agent can read and write files using tool calls. The sidebar displays
 * a live log of file operations derived from `stream.messages()`, filtering
 * for `read_file` and `write_file` tool calls.
 *
 * Key integration points:
 * - `stream.messages()` exposes the full message history including tool calls
 * - `fileOps` filters messages for file-related tool calls and extracts metadata
 * - Operations appear in the sidebar in real time as the agent works
 */
@Component({
  selector: 'app-filesystem',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" [views]="ui" [store]="uiStore" class="flex-1 min-w-0" />
      <aside class="w-72 shrink-0 border-l overflow-y-auto p-4 space-y-2"
             style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">File Operations</h3>
        @if (fileOps().length === 0) {
          <p class="text-sm italic" style="color: var(--chat-text-muted, #777);">No file operations yet</p>
        }
        @for (op of fileOps(); track $index) {
          <div class="rounded-md px-2 py-1.5 text-sm space-y-1"
               style="background: var(--chat-bg-hover, #222);">
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
                    [style.background]="op.type === 'read' ? 'rgba(59,130,246,0.15)' : 'rgba(234,179,8,0.15)'"
                    [style.color]="op.type === 'read' ? '#60a5fa' : '#facc15'">
                {{ op.type === 'read' ? 'READ' : 'WRITE' }}
              </span>
              <span class="truncate text-xs" style="color: var(--chat-text, #e0e0e0);">{{ op.path }}</span>
            </div>
            @if (op.preview) {
              <p class="truncate text-xs" style="color: var(--chat-text-muted, #777);">{{ op.preview }}</p>
            }
          </div>
        }
      </aside>
    </div>
  `,
})
export class FilesystemComponent {
  /**
   * The streaming resource connected to the filesystem graph.
   *
   * The graph uses `read_file` and `write_file` tool calls that appear
   * in `stream.messages()`. We filter and display them in the sidebar.
   */
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  readonly ui = views({
    'file-preview': FilePreviewComponent,
  });

  readonly uiStore = signalStateStore({});

  /**
   * Reactive list of file operations derived from the message history.
   *
   * Scans all messages for tool calls named `read_file` or `write_file`,
   * extracts the file path and a short result preview for sidebar display.
   */
  protected readonly fileOps = computed<FileOperation[]>(() => {
    const msgs = this.stream.messages();
    const ops: FileOperation[] = [];
    for (const msg of msgs) {
      const m = msg as unknown as Record<string, unknown>;
      if (!('tool_calls' in m) || !Array.isArray(m['tool_calls'])) continue;
      for (const tc of m['tool_calls'] as Array<Record<string, unknown>>) {
        const name = tc['name'] as string | undefined;
        if (name !== 'read_file' && name !== 'write_file') continue;
        const args = (tc['args'] ?? {}) as Record<string, unknown>;
        const path = String(args['path'] ?? args['file_path'] ?? '');
        const content = String(args['content'] ?? args['result'] ?? '');
        ops.push({
          type: name === 'read_file' ? 'read' : 'write',
          path,
          preview: content.slice(0, 80),
        });
      }
    }
    return ops;
  });
}
