import { describe, expect, it } from 'vitest';
import { extractTsDocSections, extractPyDocSections } from './extract-docs';

describe('extractTsDocSections', () => {
  it('extracts JSDoc blocks with signature, description, params, and returns', () => {
    const source = `
/**
 * StreamingService provides real-time token streaming from LangGraph.
 *
 * Call \`connect()\` to establish the streaming connection, then subscribe
 * to the returned Observable for incremental tokens.
 */
export class StreamingService {
  /**
   * Starts a streaming session with the given prompt.
   * @param prompt - The user message to send
   * @returns Observable emitting StreamEvent objects
   */
  stream(prompt: string): Observable<StreamEvent> {}
}
`;
    const sections = extractTsDocSections(source, 'streaming.service.ts');

    expect(sections).toHaveLength(2);

    expect(sections[0].title).toBe('StreamingService');
    expect(sections[0].signature).toContain('export class StreamingService');
    expect(sections[0].description).toContain('real-time token streaming');
    expect(sections[0].params).toEqual([]);
    expect(sections[0].returns).toBeNull();
    expect(sections[0].sourceFile).toBe('streaming.service.ts');
    expect(sections[0].language).toBe('typescript');

    expect(sections[1].title).toBe('stream');
    expect(sections[1].signature).toContain('stream(prompt: string)');
    expect(sections[1].description).toContain('streaming session');
    expect(sections[1].params).toEqual([{ name: 'prompt', description: 'The user message to send' }]);
    expect(sections[1].returns).toBe('Observable emitting StreamEvent objects');
  });

  it('returns empty array when no JSDoc blocks exist', () => {
    const source = `export function foo() { return 1; }`;
    expect(extractTsDocSections(source, 'foo.ts')).toEqual([]);
  });
});

describe('extractPyDocSections', () => {
  it('extracts docstrings with signature and description', () => {
    const source = `
class StreamingGraph:
    """
    LangGraph StateGraph that streams LLM responses token by token.

    The graph accepts a user message, passes it through a prompt template,
    and streams the response via LangSmith.
    """

    def invoke(self, message: str) -> AsyncIterator[str]:
        """Stream tokens for the given user message."""
        pass
`;
    const sections = extractPyDocSections(source, 'graph.py');

    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe('StreamingGraph');
    expect(sections[0].signature).toBe('class StreamingGraph');
    expect(sections[0].description).toContain('streams LLM responses');
    expect(sections[0].language).toBe('python');
    expect(sections[1].title).toBe('invoke');
    expect(sections[1].signature).toContain('def invoke');
  });

  it('returns empty array when no docstrings exist', () => {
    const source = `def foo():\n    return 1`;
    expect(extractPyDocSections(source, 'foo.py')).toEqual([]);
  });
});
