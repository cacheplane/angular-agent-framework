# Production Deployment with LangGraph Cloud

<Summary>
Deploy a LangGraph graph to LangGraph Cloud and connect an Angular app using
`agent()` from `@cacheplane/langgraph`. This tutorial covers
`langgraph deploy`, environment configuration, Vercel hosting for Angular, and
CI automation.
</Summary>

<Prompt>
Build a production-ready Angular chat app that connects to a LangGraph Cloud deployment using `agent()` from `@cacheplane/langgraph`. Configure the `apiUrl` to point to your deployed LangGraph Cloud endpoint and set `assistantId` to match the graph name in `langgraph.json`. Display the deployment status via `stream.status()` and show the thread ID from the `onThreadId` callback.
</Prompt>

<Steps>
<Step title="Package the graph for deployment">

Create a `langgraph.json` in your Python project root that maps graph names to their entry points:

```json
{
  "graphs": {
    "deployment-runtime": "./src/graph.py:graph"
  },
  "dependencies": ["./pyproject.toml"],
  "env": ".env"
}
```

The key `"deployment-runtime"` becomes the `assistantId` your Angular app uses.

</Step>
<Step title="Deploy with langgraph deploy">

Install the LangGraph CLI and authenticate with LangSmith, then deploy:

```bash
pip install langgraph-cli
langgraph deploy
```

The CLI packages your graph, pushes it to LangGraph Cloud, and returns a deployment URL of the form `https://<name>.langgraph.app`.

<Tip>
Run `langgraph dev` first to test locally before deploying. It starts a local server on port 8123 compatible with the production API.
</Tip>

</Step>
<Step title="Configure the Angular environment">

Set the deployment URL in your Angular environment files:

```typescript
// environment.ts (production)
export const environment = {
  production: true,
  langGraphApiUrl: 'https://your-deployment.langgraph.app',
  deploymentRuntimeAssistantId: 'deployment-runtime',
};
```

```typescript
// environment.development.ts
export const environment = {
  production: false,
  langGraphApiUrl: 'http://localhost:4307/api',
  deploymentRuntimeAssistantId: 'deployment-runtime',
};
```

Angular's file replacement swaps the environment at build time.

</Step>
<Step title="Connect agent() to the deployment">

In your component, pass the deployment URL and assistant ID to `agent()`:

```typescript
// deployment-runtime.component.ts
import { agent } from '@cacheplane/langgraph';
import { environment } from '../environments/environment';

export class DeploymentRuntimeComponent {
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.deploymentRuntimeAssistantId,
    onThreadId: (id: string) => {
      this.currentThreadId = id;
    },
  });

  currentThreadId = '';

  send(text: string): void {
    this.stream.submit({ messages: [{ role: 'human', content: text }] });
  }
}
```

Use `stream.status()` to render a live connection badge in the sidebar.

</Step>
<Step title="Host the Angular app on Vercel">

Add a `vercel.json` to your Angular project to configure SPA routing and the API proxy:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://your-deployment.langgraph.app/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Deploy with the Vercel CLI:

```bash
npm install -g vercel
vercel --prod
```

The `/api` rewrite proxies LangGraph requests through Vercel, avoiding CORS issues and keeping your LangSmith API key server-side.

<Warning>
Never expose your LangSmith API key in client-side code. Use Vercel environment variables and the server-side proxy pattern shown above.
</Warning>

</Step>
<Step title="Automate deployments with CI">

Add a GitHub Actions workflow to deploy on every push to `main`:

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-graph:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install langgraph-cli
      - run: langgraph deploy
        env:
          LANGSMITH_API_KEY: ${{ secrets.LANGSMITH_API_KEY }}

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx nx build cockpit-langgraph-deployment-runtime-angular
      - run: vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
```

<Tip>
Deploy the graph before the frontend so the new API is live before traffic reaches it.
</Tip>

</Step>
</Steps>

<Tip>
The `stream.status()` signal reflects the live connection state: `idle`, `streaming`, or `error`. Bind it to a status badge in your sidebar to give users instant feedback on the deployment health.
</Tip>

<Warning>
The `assistantId` in your Angular component must exactly match the graph key in `langgraph.json`. A mismatch results in a 404 from the LangGraph Cloud API.
</Warning>
