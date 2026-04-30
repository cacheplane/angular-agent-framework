// SPDX-License-Identifier: MIT
import fs from 'fs';

export const addAgentTool = {
  name: 'add_angular',
  description: 'Generate npm install command and app.config.ts diff to add angular',
  inputSchema: {
    type: 'object',
    properties: {
      appConfigPath: { type: 'string', description: 'Path to app.config.ts' },
    },
    required: ['appConfigPath'],
  },
};

export function handleAddAgent(args: Record<string, unknown>) {
  const appConfigPath = args['appConfigPath'] as string;

  if (!fs.existsSync(appConfigPath)) {
    return { content: [{ type: 'text', text: `File not found or is not an Angular app.config.ts: ${appConfigPath}` }] };
  }
  const content = fs.readFileSync(appConfigPath, 'utf8');
  if (!content.includes('ApplicationConfig') && !content.includes('appConfig')) {
    return { content: [{ type: 'text', text: `File does not appear to be an Angular app.config.ts: ${appConfigPath}` }] };
  }

  const result = `Steps to add angular:

1. Install the package:
\`\`\`bash
npm install @cacheplane/langgraph
\`\`\`

2. Apply this change to ${appConfigPath}:
\`\`\`diff
+import { provideAgent } from '@cacheplane/langgraph';

 export const appConfig: ApplicationConfig = {
   providers: [
+    provideAgent({ apiUrl: 'REPLACE_WITH_YOUR_LANGGRAPH_URL' }),
     // ... existing providers
   ]
 };
\`\`\`

Replace REPLACE_WITH_YOUR_LANGGRAPH_URL with your LangGraph server URL (e.g. http://localhost:2024).`;

  return { content: [{ type: 'text', text: result }] };
}
