"""
A2UI Contact Form Graph

Demonstrates the A2UI (Agent-to-UI) protocol by emitting hardcoded JSONL
that builds an interactive contact form on the Angular frontend.
Uses the v0.9 envelope format: {"createSurface": {...}}.

The graph does NOT use an LLM for UI generation — A2UI JSONL requires
exact format adherence that LLMs cannot reliably provide. The LLM is
only used for conversational responses to form submission events.
"""

import json
from langgraph.graph import StateGraph, MessagesState, END
from langchain_core.messages import AIMessage

A2UI_PREFIX = "---a2ui_JSON---"

# v0.9 envelope format: each message is {"<type>": {<payload>}}
CONTACT_FORM_JSONL = A2UI_PREFIX + "\n" + "\n".join([
    json.dumps({"createSurface": {
        "surfaceId": "contact", "catalogId": "basic", "sendDataModel": True,
    }}),
    json.dumps({"updateDataModel": {
        "surfaceId": "contact",
        "value": {"name": "", "email": "", "department": "Engineering", "consent": False},
    }}),
    json.dumps({"updateComponents": {
        "surfaceId": "contact",
        "components": [
            {"id": "root", "component": "Column", "children": ["card"]},
            {"id": "card", "component": "Card", "title": "Contact Us", "children": [
                "name_field", "email_field", "dept_picker", "consent_check", "divider", "submit_btn",
            ]},
            {"id": "name_field", "component": "TextField",
             "label": "Name", "value": {"path": "/name"}, "placeholder": "Your full name",
             "checks": [
                 {"condition": {"call": "required", "args": {"value": {"path": "/name"}}},
                  "message": "Name is required"},
             ]},
            {"id": "email_field", "component": "TextField",
             "label": "Email", "value": {"path": "/email"}, "placeholder": "you@company.com",
             "checks": [
                 {"condition": {"call": "required", "args": {"value": {"path": "/email"}}},
                  "message": "Email is required"},
                 {"condition": {"call": "email", "args": {"value": {"path": "/email"}}},
                  "message": "Must be a valid email address"},
             ]},
            {"id": "dept_picker", "component": "ChoicePicker",
             "label": "Department",
             "options": ["Engineering", "Sales", "Support", "Marketing"],
             "selected": {"path": "/department"}},
            {"id": "consent_check", "component": "CheckBox",
             "label": "I agree to be contacted", "checked": {"path": "/consent"}},
            {"id": "divider", "component": "Divider"},
            {"id": "submit_btn", "component": "Button",
             "label": "Submit",
             "checks": [
                 {"condition": {"call": "and", "args": {"values": [
                     {"call": "required", "args": {"value": {"path": "/name"}}},
                     {"call": "email", "args": {"value": {"path": "/email"}}},
                     {"path": "/consent"},
                 ]}},
                  "message": "Complete all required fields and agree to be contacted"},
             ],
             "action": {"event": {"name": "formSubmit", "context": {"formId": "contact"}}}},
        ],
    }}),
]) + "\n"  # Trailing newline required — parser processes at \n boundaries


def build_a2ui_graph():
    """
    Single-node graph:
    - On first message: emits hardcoded A2UI JSONL for the contact form
    - On a2ui_event messages: responds with a confirmation message
    """

    async def create_form(state: MessagesState) -> dict:
        last = state["messages"][-1]

        # Check if this is a form submission event from the A2UI surface
        try:
            payload = json.loads(last.content)
            if isinstance(payload, dict) and payload.get("type") == "a2ui_event":
                name = payload.get("context", {}).get("formId", "unknown")
                return {"messages": [AIMessage(
                    content=f"Thanks for submitting the **{name}** form! We'll be in touch soon.",
                )]}
        except (json.JSONDecodeError, AttributeError):
            pass

        # Any other message — emit the contact form
        return {"messages": [AIMessage(content=CONTACT_FORM_JSONL)]}

    graph = StateGraph(MessagesState)
    graph.add_node("create_form", create_form)
    graph.set_entry_point("create_form")
    graph.add_edge("create_form", END)

    return graph.compile()


graph = build_a2ui_graph()
