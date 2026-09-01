import { agentUrlFor, classifyStatus, deployedTopics } from './verify-ag-ui-runtime';

/**
 * These pin the semantics that make the check meaningful. A well-intentioned
 * "simplify this to status < 500" would keep the suite green while silently
 * reintroducing the blind spot it exists to close: a 404 from a stale image.
 */
describe('classifyStatus', () => {
  it('treats 422 as healthy — the request model rejected an empty body, so the route exists', () => {
    expect(classifyStatus(422)).toEqual({ ok: true, status: 422 });
  });

  it('fails a 404 and names the deployed image as a suspect', () => {
    const verdict = classifyStatus(404);
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toMatch(/route not found/);
  });

  it('fails a 401 and points at the internal-token mismatch', () => {
    const verdict = classifyStatus(401);
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toMatch(/AG_UI_INTERNAL_TOKEN/);
  });

  it('fails upstream 5xx rather than reporting a healthy topic', () => {
    expect(classifyStatus(502).ok).toBe(false);
  });

  it('does not treat a 200 as a failure', () => {
    expect(classifyStatus(200).ok).toBe(true);
  });
});

describe('deployedTopics', () => {
  it('includes subagents — the topic whose absence this check was built to catch', () => {
    expect(deployedTopics().map((t) => t.topic)).toContain('subagents');
  });

  it('covers the runtimes product, which shares the same deployed runtime', () => {
    expect(deployedTopics().map((t) => t.product)).toContain('runtimes');
  });

  it('excludes capabilities hosted outside ag-ui-dev', () => {
    // mastra declares no pythonDir — its backend is deployments/ag-ui-mastra,
    // so probing it here would assert against a runtime that never mounts it.
    expect(deployedTopics().map((t) => t.topic)).not.toContain('mastra');
  });

  it('is driven off the registry so new topics are covered without editing this script', () => {
    const topics = deployedTopics().map((t) => t.topic);
    expect(topics.length).toBeGreaterThanOrEqual(9);
    expect([...topics]).toEqual([...topics].sort());
  });
});

describe('agentUrlFor', () => {
  it('serves ag-ui capabilities under /ag-ui', () => {
    expect(agentUrlFor({ product: 'ag-ui', topic: 'subagents' })).toBe(
      '/ag-ui/subagents/agent'
    );
  });

  it('serves runtimes capabilities under /runtimes, not /ag-ui', () => {
    // Both proxy to the same Railway app, but the examples route table has a
    // separate rule per product — probing a runtime under /ag-ui would pass
    // through the wrong rule and stop reflecting what the SPA actually calls.
    expect(agentUrlFor({ product: 'runtimes', topic: 'aws-strands' })).toBe(
      '/runtimes/aws-strands/agent'
    );
  });
});
