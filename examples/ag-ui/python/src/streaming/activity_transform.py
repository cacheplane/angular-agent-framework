"""Maps a `subagent_activity` CUSTOM event (emitted by the research tool /
SubagentStreamHandler via adispatch_custom_event) to a native AG-UI ACTIVITY event.

Pure and stateless (1:1): build patches purely from the event fields — never
track state in the transform. Anything that is not a `subagent_activity` CUSTOM
event returns None.

Supported phases: started, message_start, message, tool_call, tool_result,
finished.  Unknown phases return None.
"""
import json
from typing import Optional

from ag_ui.core import ActivityDeltaEvent, ActivitySnapshotEvent, BaseEvent, EventType

ACTIVITY_TYPE = "subagent"
_CUSTOM_NAME = "subagent_activity"


def subagent_custom_to_activity(event: BaseEvent) -> Optional[BaseEvent]:
    if getattr(event, "type", None) != EventType.CUSTOM:
        return None
    if getattr(event, "name", None) != _CUSTOM_NAME:
        return None
    value = getattr(event, "value", None)
    if isinstance(value, str):  # bridge may JSON-serialize custom values
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return None
    if not isinstance(value, dict):
        return None

    sid = value.get("subagent_id")
    phase = value.get("phase")
    if not sid or not phase:
        return None

    if phase == "started":
        return ActivitySnapshotEvent(
            type=EventType.ACTIVITY_SNAPSHOT,
            message_id=sid,
            activity_type=ACTIVITY_TYPE,
            content={
                "toolCallId": sid,
                "name": value.get("name"),
                "status": "running",
                "messages": [],
                "toolCalls": [],
            },
            replace=True,
        )

    if phase == "message_start":
        message_index = value.get("message_index")
        return ActivityDeltaEvent(
            type=EventType.ACTIVITY_DELTA,
            message_id=sid,
            activity_type=ACTIVITY_TYPE,
            patch=[
                {
                    "op": "add",
                    "path": "/messages/-",
                    "value": {
                        "id": f"{sid}-{message_index}",
                        "role": "assistant",
                        "content": "",
                        "toolCallIds": [],
                    },
                }
            ],
        )

    if phase == "message":
        message_index = value.get("message_index")
        return ActivityDeltaEvent(
            type=EventType.ACTIVITY_DELTA,
            message_id=sid,
            activity_type=ACTIVITY_TYPE,
            patch=[
                {
                    "op": "replace",
                    "path": f"/messages/{message_index}/content",
                    "value": value.get("text", ""),
                }
            ],
        )

    if phase == "tool_call":
        message_index = value.get("message_index")
        tool_call_id = value.get("tool_call_id")
        return ActivityDeltaEvent(
            type=EventType.ACTIVITY_DELTA,
            message_id=sid,
            activity_type=ACTIVITY_TYPE,
            patch=[
                {
                    "op": "add",
                    "path": "/toolCalls/-",
                    "value": {
                        "id": tool_call_id,
                        "name": value.get("name"),
                        "args": value.get("args"),
                        "status": "running",
                    },
                },
                {
                    "op": "add",
                    "path": f"/messages/{message_index}/toolCallIds/-",
                    "value": tool_call_id,
                },
            ],
        )

    if phase == "tool_result":
        tool_index = value.get("tool_index")
        return ActivityDeltaEvent(
            type=EventType.ACTIVITY_DELTA,
            message_id=sid,
            activity_type=ACTIVITY_TYPE,
            patch=[
                {
                    "op": "replace",
                    "path": f"/toolCalls/{tool_index}/status",
                    "value": value.get("status", "complete"),
                },
                {
                    "op": "replace",
                    "path": f"/toolCalls/{tool_index}/result",
                    "value": value.get("result"),
                },
            ],
        )

    if phase == "finished":
        return ActivityDeltaEvent(
            type=EventType.ACTIVITY_DELTA,
            message_id=sid,
            activity_type=ACTIVITY_TYPE,
            patch=[{"op": "replace", "path": "/status", "value": value.get("status", "complete")}],
        )

    return None
