"""
A2UI Contact Form Graph

Demonstrates the A2UI (Agent-to-UI) protocol by streaming JSONL that
builds an interactive contact form on the Angular frontend.
"""

import json
from langgraph.graph import StateGraph, MessagesState, END
from langchain_core.messages import AIMessage

A2UI_PREFIX = "---a2ui_JSON---"

CONTACT_FORM_JSONL = A2UI_PREFIX + "\n" + "\n".join([
    json.dumps({"type": "createSurface", "surfaceId": "contact", "catalogId": "basic"}),
    json.dumps({"type": "updateDataModel", "surfaceId": "contact", "value": {
        "name": "", "email": "", "department": "Engineering", "consent": False,
    }}),
    json.dumps({"type": "updateComponents", "surfaceId": "contact", "components": [
        {"id": "root", "component": "Column", "children": ["card"]},
        {"id": "card", "component": "Card", "title": "Contact Us", "children": [
            "name_field", "email_field", "dept_picker", "consent_check", "divider", "submit_btn",
        ]},
        {"id": "name_field", "component": "TextField",
         "label": "Name", "value": {"path": "/name"}, "placeholder": "Your full name",
         "_bindings": {"value": "/name"}},
        {"id": "email_field", "component": "TextField",
         "label": "Email", "value": {"path": "/email"}, "placeholder": "you@company.com",
         "_bindings": {"value": "/email"}},
        {"id": "dept_picker", "component": "ChoicePicker",
         "label": "Department",
         "options": ["Engineering", "Sales", "Support", "Marketing"],
         "selected": {"path": "/department"},
         "_bindings": {"selected": "/department"}},
        {"id": "consent_check", "component": "CheckBox",
         "label": "I agree to be contacted", "checked": {"path": "/consent"},
         "_bindings": {"checked": "/consent"}},
        {"id": "divider", "component": "Divider"},
        {"id": "submit_btn", "component": "Button",
         "label": "Submit",
         "action": {"event": {"name": "formSubmit", "context": {"formId": "contact"}}}},
    ]}),
])


def build_a2ui_graph():
    """
    Two-node graph:
    - create_form: emits the A2UI contact form surface
    - handle_event: responds to form submission events
    """

    async def create_form(state: MessagesState) -> dict:
        last = state["messages"][-1]

        # If this is an a2ui_event, route to event handling
        try:
            payload = json.loads(last.content)
            if isinstance(payload, dict) and payload.get("type") == "a2ui_event":
                return await handle_event(state, payload)
        except (json.JSONDecodeError, AttributeError):
            pass

        # First message — emit the contact form
        return {"messages": [AIMessage(content=CONTACT_FORM_JSONL)]}

    async def handle_event(state: MessagesState, payload: dict) -> dict:
        name = payload.get("context", {}).get("formId", "unknown")
        return {"messages": [AIMessage(
            content=f"Thanks for submitting the **{name}** form! We'll be in touch soon.",
        )]}

    graph = StateGraph(MessagesState)
    graph.add_node("create_form", create_form)
    graph.set_entry_point("create_form")
    graph.add_edge("create_form", END)

    return graph.compile()


graph = build_a2ui_graph()
