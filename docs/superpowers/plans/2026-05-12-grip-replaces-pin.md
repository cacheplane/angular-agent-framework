# Grip-Replaces-Pin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the always-reserved 18px left gutter on pinned thread rows by swapping the drag affordance into the same slot as the pin icon, opacity-toggled on hover.

**Architecture:** Delete the standalone `.chat-thread-list__grip` button (sibling of the row's main click button). Wrap the existing inline pin SVG in a new `.chat-thread-list__pin-slot` span; render a grip glyph as a positioned sibling inside that slot when the thread is pinned AND `actions.reorderPinned` is defined. CSS opacity-toggle on `:hover` / `:focus-within` performs the swap. The `<li>` keeps its `draggable` attribute and drag handlers — the entire row remains the drag source.

**Tech Stack:** Angular 21 standalone components, signals, CSS-in-TS, vitest.

**Reference spec:** `docs/superpowers/specs/2026-05-12-grip-replaces-pin-design.md`

---

### Task 1: Swap to pin-slot with hover opacity-toggle

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts` (template, around lines 92–150)
- Modify: `libs/chat/src/lib/styles/chat-thread-list.styles.ts` (replace `.chat-thread-list__grip` rules near lines 126–155)
- Modify: `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts` (add one new structural test)

**Context:**

The existing three `chat-thread-list__grip` tests (lines 485–511) use `.querySelector(s)('.chat-thread-list__grip')` to check presence/absence. The new structure keeps the `.chat-thread-list__grip` class name on the in-slot span, so those selectors continue to find the element when it should be there and return null when it shouldn't. **No changes to existing tests are required.**

The new structural test verifies the wrapping `.chat-thread-list__pin-slot` exists and contains both `.chat-thread-list__item-pin` and `.chat-thread-list__grip` as children for a pinned row with `reorderPinned`.

The two existing drag-and-drop tests (lines 644, 678) dispatch synthetic events on the `<li>` wrap, which is untouched — they continue to pass.

---

- [ ] **Step 1: Add the new structural test (failing)**

Insert immediately after the test on line 511 (after the closing `});` of the "grip handle does NOT render when reorderPinned absent" test) in `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts`:

```ts
it('pin slot wraps both pin SVG and grip glyph for reorderable pinned row', () => {
  const fixture = TestBed.createComponent(ChatThreadListComponent);
  fixture.componentRef.setInput('threads', [
    { id: 'p1', title: 'P1', pinned: true },
  ]);
  fixture.componentRef.setInput('actions', { reorderPinned: vi.fn().mockResolvedValue(undefined) });
  fixture.detectChanges();
  const slot = fixture.nativeElement.querySelector('.chat-thread-list__pin-slot');
  expect(slot).not.toBeNull();
  expect(slot.querySelector('.chat-thread-list__item-pin')).not.toBeNull();
  expect(slot.querySelector('.chat-thread-list__grip')).not.toBeNull();
});

it('pin slot renders without grip when reorderPinned absent', () => {
  const fixture = TestBed.createComponent(ChatThreadListComponent);
  fixture.componentRef.setInput('threads', [
    { id: 'p1', title: 'P1', pinned: true },
  ]);
  fixture.componentRef.setInput('actions', {});
  fixture.detectChanges();
  const slot = fixture.nativeElement.querySelector('.chat-thread-list__pin-slot');
  expect(slot).not.toBeNull();
  expect(slot.querySelector('.chat-thread-list__item-pin')).not.toBeNull();
  expect(slot.querySelector('.chat-thread-list__grip')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd libs/chat && npx vitest run src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts -t "pin slot"
```

Expected: FAIL with `expected null not to be null` on the `.chat-thread-list__pin-slot` query.

- [ ] **Step 3: Update the template**

In `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts`, locate the block beginning around line 122:

```html
            @if (thread.pinned && actions()?.reorderPinned) {
              <button
                type="button"
                class="chat-thread-list__grip"
                aria-label="Drag to reorder"
                draggable="false"
              >⋮⋮</button>
            }
            <button
              type="button"
              class="chat-thread-list__item"
```

Replace with (the standalone grip button is deleted entirely):

```html
            <button
              type="button"
              class="chat-thread-list__item"
```

Then locate the existing pin SVG inside the title span (around line 140):

```html
              <span class="chat-thread-list__item-title">
                @if (thread.pinned) {
                  <svg class="chat-thread-list__item-pin" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                  </svg>
                }
                {{ threadLabel(thread) }}
              </span>
```

Replace with:

```html
              <span class="chat-thread-list__item-title">
                @if (thread.pinned) {
                  <span class="chat-thread-list__pin-slot" aria-hidden="true">
                    <svg class="chat-thread-list__item-pin" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                    </svg>
                    @if (actions()?.reorderPinned) {
                      <span class="chat-thread-list__grip">⋮⋮</span>
                    }
                  </span>
                }
                {{ threadLabel(thread) }}
              </span>
```

Note: the `aria-hidden` moves from the inner `<svg>` to the outer slot `<span>` (covers both children); the SVG keeps its existing attributes minus its own aria-hidden (now redundant).

- [ ] **Step 4: Update the styles**

In `libs/chat/src/lib/styles/chat-thread-list.styles.ts`, locate this block (around lines 126–155):

```css
  .chat-thread-list__grip {
    flex-shrink: 0;
    width: 16px;
    height: 28px;
    margin-right: 2px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ngaf-chat-text-muted);
    cursor: grab;
    opacity: 0;
    transition: opacity 100ms ease;
    font-size: 11px;
    line-height: 1;
    letter-spacing: -1px;
    user-select: none;
  }
  .chat-thread-list__item-wrap:hover .chat-thread-list__grip,
  .chat-thread-list__item-wrap:focus-within .chat-thread-list__grip {
    opacity: 1;
  }
  .chat-thread-list__grip:active { cursor: grabbing; }
```

Replace with:

```css
  .chat-thread-list__pin-slot {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 13px;
    height: 13px;
    margin-right: 4px;
    flex-shrink: 0;
    vertical-align: -1px;
  }
  .chat-thread-list__pin-slot .chat-thread-list__item-pin {
    position: absolute;
    inset: 0;
    width: 13px;
    height: 13px;
    opacity: 1;
    transition: opacity 100ms ease;
  }
  .chat-thread-list__pin-slot .chat-thread-list__grip {
    position: absolute;
    inset: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--ngaf-chat-text-muted);
    font-size: 11px;
    line-height: 1;
    letter-spacing: -1px;
    opacity: 0;
    transition: opacity 100ms ease;
    user-select: none;
    pointer-events: none;
  }
  .chat-thread-list__item-wrap:hover .chat-thread-list__pin-slot .chat-thread-list__item-pin,
  .chat-thread-list__item-wrap:focus-within .chat-thread-list__pin-slot .chat-thread-list__item-pin {
    opacity: 0;
  }
  .chat-thread-list__item-wrap:hover .chat-thread-list__pin-slot .chat-thread-list__grip,
  .chat-thread-list__item-wrap:focus-within .chat-thread-list__pin-slot .chat-thread-list__grip {
    opacity: 1;
  }
  .chat-thread-list__item-wrap[draggable="true"] { cursor: grab; }
  .chat-thread-list__item-wrap[draggable="true"]:active { cursor: grabbing; }
```

- [ ] **Step 5: Run new tests to verify they pass**

```
cd libs/chat && npx vitest run src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts -t "pin slot"
```

Expected: PASS — both new tests green.

- [ ] **Step 6: Run the full chat-thread-list spec to confirm no regression**

```
cd libs/chat && npx vitest run src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts
```

Expected: PASS — all tests including the original three grip tests and the two drag-and-drop tests.

- [ ] **Step 7: Run the full chat suite**

```
cd libs/chat && npx vitest run
```

Expected: PASS — every chat spec.

- [ ] **Step 8: Manual smoke verification**

(If the implementer can run the dev server. Otherwise document for the reviewer in PR description.)

1. Start the chat example dev server.
2. Pin one thread.
3. **Verify:** Pinned row's left edge aligns with unpinned rows' left edge — no gutter shift.
4. **Hover** the pinned row.
5. **Verify:** Pin icon fades out, grip glyph `⋮⋮` fades in over the same 13×13 slot. Cursor changes to `grab`.
6. Pin a second thread; drag-reorder.
7. **Verify:** Drag indicator, drop, and reorder persistence all behave as before PR #280.

- [ ] **Step 9: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts \
        libs/chat/src/lib/styles/chat-thread-list.styles.ts \
        libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts
git commit -m "$(cat <<'EOF'
fix(chat): drag handle replaces pin icon on hover (no left-gutter shift)

PR #280 introduced a standalone grip button as a sibling of the row's
main click button. The grip occupies 18px (16px width + 2px margin)
of inline space whether visible or not, so pinned rows sat 18px right
of unpinned rows. The user disliked the constant layout shift.

Drop the standalone grip. Wrap the existing pin SVG in a fixed-size
.chat-thread-list__pin-slot span; render the grip glyph as an
absolutely-positioned sibling inside that slot. CSS opacity-toggle on
:hover / :focus-within swaps which icon is visible. Zero layout
shift, same affordance.

The <li> remains the drag source — all drag handlers untouched. Move
up / Move down menu items (keyboard path) unchanged.

EOF
)"
```

- [ ] **Step 10: Push and open PR**

```bash
git push -u origin claude/grip-replaces-pin
gh pr create --title "fix(chat): drag handle replaces pin icon on hover (no left-gutter shift)" --body "$(cat <<'EOF'
## Summary

- Drops the standalone `.chat-thread-list__grip` button that PR #280 introduced as a sibling of the row's main click button
- Wraps the existing pin SVG in a new `.chat-thread-list__pin-slot` (13×13px); renders the grip glyph as an absolutely-positioned sibling inside the same slot
- CSS opacity-toggles on `:hover` / `:focus-within` swap which icon is visible
- The `<li>` wrap remains the drag source — all drag handlers untouched

**Result:** zero left-gutter layout shift between unpinned, pinned, and pinned-hover states.

## Spec & Plan

- `docs/superpowers/specs/2026-05-12-grip-replaces-pin-design.md`
- `docs/superpowers/plans/2026-05-12-grip-replaces-pin.md`

## Test plan

- [x] Two new vitest tests assert the pin-slot structure
- [x] All five PR #280 tests (grip presence, drag-and-drop, Move up/down) continue to pass
- [ ] Manual (reviewer):
  - [ ] Pinned row left edge aligns with unpinned rows (no gutter)
  - [ ] Hover pinned row → pin icon fades to grip glyph in same slot
  - [ ] Drag-reorder still works
  - [ ] Move up / Move down menu items still work (keyboard path)
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** template change (steps 3), styles change (step 4), tests (steps 1–2, 5–7), accessibility (`aria-hidden` move documented in step 3 + pointer-events on grip in step 4), manual verification (step 8). Complete.
- **No placeholders:** every code block is exact final content.
- **Type consistency:** no new TypeScript symbols; all CSS class names match between template and styles. Selectors used in tests match those rendered.
- **Existing tests preserved:** confirmed via grep — `.chat-thread-list__grip` selector still finds the (now-nested) grip span.
