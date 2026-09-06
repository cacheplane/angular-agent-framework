/**
 * Playwright config for recording the stage walkthrough fixture against the
 * REAL model, rather than the aimock replay `record-stage.config.ts` uses.
 *
 * `public/stage-replay.json` is shipped behind a pill that reads "Replaying a
 * recorded LangGraph run", so the words in it have to be words a model actually
 * said. Recording through aimock makes the stream events real but the prose
 * authored, which the pill then misrepresents.
 *
 * Unlike the other configs this one starts NOTHING — bring your own servers, so
 * that the OpenAI key stays in your shell and never reaches a committed file:
 *
 *   # 1. backend on :2024, pointed at the real API
 *   cd examples/chat/python && \
 *     export OPENAI_API_KEY=$(grep -E '^OPENAI_API_KEY=' ../../../.env | cut -d= -f2-) && \
 *     uv run langgraph dev --port 2024 --no-browser
 *
 *   # 2. the demo on :4200 (dev build — /stage?record=1 is inert in production)
 *   npx nx serve examples-chat-angular --port 4200
 *
 *   # 3. one take
 *   npx playwright test -c examples/chat/angular/e2e/record-stage-live.config.ts record-stage-fixture
 *
 * Takes vary: the model is free to answer how it likes, so record several and
 * commit the best COMPLETE one (the recorder's own assertions — seven runs in
 * the exact beat order, a truthy threadId — reject incomplete takes for you).
 * Picking a take is the same latitude a demo video has. Editing what the model
 * said is not: that is what this config exists to stop.
 *
 * The timeout is far longer than the replay config's because a real run streams
 * at model speed, with reasoning, instead of at aimock speed.
 *
 * In a worktree, `../../../.env` (relative to examples/chat/python) does not
 * exist — the `.env` lives in the primary checkout, so point the export at
 * that path instead.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/record-stage-fixture.record.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 600_000,
  use: {
    baseURL: 'http://localhost:4200',
    viewport: { width: 1200, height: 720 },
  },
  outputDir: './.record-output',
});
