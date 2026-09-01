# Skills with Deep Agents

<Summary>
Give an agent procedures it loads on demand. A skill is a folder with a `SKILL.md`;
`SkillsMiddleware` puts only the frontmatter — a name and a description — in the system prompt
and leaves the body on the filesystem until a request matches. Rendering both halves is what
makes progressive disclosure visible rather than theoretical.
</Summary>

<Prompt>
Add a skill-index panel beside the `<chat>` component. Read `skills_metadata` from
`agent.customEvents()`, and mark each skill as opened when `agent.toolCalls()` shows a
`read_file` under that skill's directory.
</Prompt>

<Callout type="info" title="Provider setup lives in the LangGraph quickstart">
This guide assumes `provideAgent()` is already configured. If it is not, work through the
[LangGraph quickstart](/docs/langgraph/getting-started/quickstart) first.
</Callout>

<Steps>
<Step title="Write a SKILL.md">

The frontmatter is the part the model sees first, so the `description` is doing the routing.
Write it as a matching rule, not as a summary:

```markdown
---
name: runway-analysis
description: Decide whether a runway is long enough for a given aircraft at a given field elevation. Use when the user asks about runway suitability, takeoff or landing distance, or operating out of a high-elevation field.
license: MIT
---

# Runway Analysis

## Procedure

1. Get the field elevation and the longest runway length.
2. Read `/skills/runway-analysis/reference/margins.md` for the margin table.
   Do not work from memory — the table is the authority.
3. Compare, then state the verdict and the two numbers you compared.
```

Step 2 is the second stage of the disclosure. The reference file costs nothing until the
`SKILL.md` sends the agent to it.

</Step>
<Step title="Mount the skills somewhere a server can serve">

`SkillsMiddleware` reads through a backend, and the choice of backend is a deployment decision.
`FilesystemBackend` documents itself as inappropriate for servers and HTTP APIs, which rules it
out for anything with a public URL. Seeding a process-local store and mounting it read-only
keeps the content in the repo without giving the agent the host:

```python
def _seed_skills_store() -> InMemoryStore:
    store = InMemoryStore()
    backend = StoreBackend(namespace=lambda _runtime: SKILLS_NAMESPACE, store=store)
    for path in sorted(SKILLS_DIR.rglob("*.md")):
        backend.write(f"/{path.relative_to(SKILLS_DIR).as_posix()}", path.read_text())
    return store

graph = create_deep_agent(
    ...,
    backend=CompositeBackend(
        default=StateBackend(),
        routes={"/skills/": StoreBackend(namespace=..., store=SKILLS_STORE)},
    ),
    skills=["/skills/"],
)
```

<Callout type="warning" title="CompositeBackend strips the route prefix">
Seed the store at `/runway-analysis/SKILL.md`, not `/skills/runway-analysis/SKILL.md`. The
composite removes the matched prefix before delegating and re-adds it to the result, so a store
seeded with the prefix surfaces to the agent as `/skills/skills/runway-analysis/...` and the
skill scan finds nothing.
</Callout>

</Step>
<Step title="Tell the model the index is an index">

The model has the names and descriptions and nothing else, so the prompt has to say what to do
with them:

```markdown
Your procedures are not in this prompt — they are skills under `/skills/`.
When a request matches a skill, read its `SKILL.md` before you start, and
follow the procedure it gives you. If the `SKILL.md` points at another file,
read that too — the numbers in a reference file are the authority, and your
recollection is not.
```

</Step>
<Step title="Render both halves">

`skills_metadata` is annotated `PrivateStateAttr`, so it is absent from the `values` stream and
needs the same custom-event shim as the memory capability. What the agent actually opened needs
no shim at all — `read_file` is an ordinary tool call:

```typescript
private readonly openedPaths = computed<string[]>(() => {
  const paths: string[] = [];
  for (const call of this.agent.toolCalls()) {
    if (call.name !== 'read_file') continue;
    const path = (call.args as Record<string, unknown> | undefined)?.['file_path'];
    if (typeof path === 'string' && !paths.includes(path)) paths.push(path);
  }
  return paths;
});
```

Match those against each skill's directory and the panel shows exactly what progressive
disclosure bought: one skill opened, the rest still on disk.

</Step>
</Steps>

<Tip>
The strongest test of a skills setup is the skill that does NOT get opened. If every skill's
files are read on every request, the index is not routing anything and the descriptions need
work.
</Tip>

<Related>
- [Deep Agents Memory](/deep-agents/core-capabilities/memory/overview/python) — the same private-state visibility problem, for `memory_contents`
- [Deep Agents Filesystem](/deep-agents/core-capabilities/filesystem/overview/python) — the backends the skill mount is built from
</Related>
