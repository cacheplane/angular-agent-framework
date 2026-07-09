import { Component, computed } from '@angular/core';
import { ChatComponent, views } from '@threadplane/chat';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { injectAgent } from '@threadplane/langgraph';
import { signalStateStore } from '@threadplane/render';
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
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout sidebarWidth="18rem">
      <chat main [agent]="agent" [views]="ui" [store]="uiStore" class="flex-1 min-w-0" />
      <div sidebar class="panel">
        <h3 class="cap">File Operations</h3>
        @if (fileOps().length === 0) {
          <p class="empty">No file operations yet</p>
        }
        @for (op of fileOps(); track $index) {
          <div class="file-op">
            <div class="file-op__head">
              <span class="op-badge"
                    [class.op-badge--read]="op.type === 'read'"
                    [class.op-badge--write]="op.type === 'write'">
                {{ op.type === 'read' ? 'READ' : 'WRITE' }}
              </span>
              <span class="file-path">{{ op.path }}</span>
            </div>
            @if (op.preview) {
              <p class="preview">{{ op.preview }}</p>
            }
          </div>
        }
      </div>
    </example-chat-layout>
  `,
  styles: [`
    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1rem;
      background: var(--tplane-chat-bg);
      color: var(--tplane-chat-text);
    }

    .cap {
      margin: 0;
      font-size: var(--tplane-chat-font-size-xs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--tplane-chat-text-muted);
    }

    .empty {
      margin: 0;
      font-size: var(--tplane-chat-font-size-sm);
      font-style: italic;
      color: var(--tplane-chat-text-muted);
    }

    .file-op {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.375rem 0.5rem;
      border-radius: var(--tplane-chat-radius-card);
      background: var(--tplane-chat-surface-alt);
      font-size: var(--tplane-chat-font-size-sm);
    }

    .file-op__head {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
    }

    .op-badge {
      display: inline-flex;
      align-items: center;
      flex: 0 0 auto;
      border-radius: var(--tplane-chat-radius-button);
      padding: 0.125rem 0.375rem;
      font-size: var(--tplane-chat-font-size-xs);
      font-weight: 600;
    }

    .op-badge--read {
      background: color-mix(in srgb, var(--tplane-chat-primary) 12%, var(--tplane-chat-surface));
      color: var(--tplane-chat-primary);
    }

    .op-badge--write {
      background: var(--tplane-chat-warning-bg);
      color: var(--tplane-chat-warning-text);
    }

    .file-path {
      min-width: 0;
      overflow: hidden;
      color: var(--tplane-chat-text);
      font-size: var(--tplane-chat-font-size-xs);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .preview {
      margin: 0;
      overflow: hidden;
      color: var(--tplane-chat-text-muted);
      font-size: var(--tplane-chat-font-size-xs);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `],
})
export class FilesystemComponent {
  readonly ui = views({ 'file-preview': FilePreviewComponent });
  readonly uiStore = signalStateStore({});

  /**
   * The streaming resource connected to the filesystem graph.
   *
   * The graph uses `read_file` and `write_file` tool calls that appear
   * in `stream.messages()`. We filter and display them in the sidebar.
   */
  protected readonly agent = injectAgent();

  /**
   * Reactive list of file operations derived from the message history.
   *
   * Scans all messages for tool calls named `read_file` or `write_file`,
   * extracts the file path and a short result preview for sidebar display.
   */
  protected readonly fileOps = computed<FileOperation[]>(() => {
    const msgs = this.agent.langGraphMessages();
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
