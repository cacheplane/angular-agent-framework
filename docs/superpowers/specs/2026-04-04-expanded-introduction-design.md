# Expanded Introduction — Full Getting Started Tutorial

**Date:** 2026-04-04
**Scope:** Rewrite `getting-started/introduction.mdx` as a comprehensive end-to-end tutorial

## Overview

The current introduction is a brief 64-line overview. It needs to become the primary onboarding experience — teaching developers the full workflow from building a LangGraph agent to connecting it with Angular via agent().

## Target Audience

Both Angular developers new to AI agents AND AI developers new to Angular. The tutorial should work for either starting point.

## Tutorial Structure

The introduction becomes a multi-section tutorial covering the complete workflow:

### Section 1: What is Angular Agent Framework?
- One-paragraph pitch: Angular Signals + LangGraph streaming
- Key value props (3-4 bullets)
- "What you'll build" preview — a streaming chat app connected to a real agent

### Section 2: Build Your Agent (Python)
- Use the repo's existing `examples/chat-agent` as the reference
- Show the minimal LangGraph agent (`agent.py` with `MessagesState`, `call_model` node)
- Show `langgraph.json` configuration
- Explain the graph: nodes, edges, state

### Section 3: Run Locally
- Install LangGraph CLI: `pip install -U "langgraph-cli[inmem]"`
- Start dev server: `langgraph dev`
- Verify at `http://localhost:2024`
- Test in LangGraph Studio

### Section 4: Connect with Angular
- Install agent: `npm install @cacheplane/langgraph`
- Configure provider in `app.config.ts`
- Create a chat component with `agent()`
- Show TypeScript + Template code with Tabs
- Explain the Signals: messages(), status(), error()

### Section 5: Deploy to LangGraph Cloud
- Push agent to GitHub
- Deploy via LangSmith dashboard
- Update Angular `apiUrl` to deployment URL
- Production considerations

### Section 6: Next Steps
- CardGroup linking to all guide pages
- Links to concepts for deeper understanding

## MDX Components Used
- `<Callout>` for prerequisites and tips
- `<Steps>` for sequential instructions
- `<Tabs>` for TypeScript/Template and Python/Config code
- `<CardGroup>` for next steps navigation

## Files Modified
- Replace: `apps/website/content/docs-v2/getting-started/introduction.mdx`

## Verification
- Open /docs/getting-started/introduction
- Verify all 6 sections render with MDX components
- Code blocks are syntax highlighted
- TOC shows all sections
- Mobile renders properly
