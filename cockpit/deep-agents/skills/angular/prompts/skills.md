# Deep Agents Skills (Angular)

This capability shows progressive disclosure happening. A skill is a folder with a `SKILL.md` whose YAML frontmatter carries a name and a description; `SkillsMiddleware` puts only that frontmatter in the system prompt and leaves the body on the filesystem until a request matches. A reference file inside the skill stays unread until the `SKILL.md` sends the agent to it.

The sidebar therefore has two halves. The index comes from `skills_metadata`, which is annotated `PrivateStateAttr` and so never reaches the `values` stream — the graph republishes it as a `custom` stream event, and the checkpoint covers a reopened thread. The files the agent actually opened come from the ordinary tool-call stream, because `read_file` is not private at all.
