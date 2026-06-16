"""Maps a `subagent_activity` CUSTOM event (emitted by the research tool /
SubagentStreamHandler via get_stream_writer) to a native AG-UI ACTIVITY event.

Pure and stateless (1:1): the handler sends accumulated `text_so_far`, so each
DELTA carries the full text via JSON-patch `replace` (JSON-patch has no string
append). Anything that is not a `subagent_activity` CUSTOM event returns None.
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
            content={"toolCallId": sid, "name": value.get("name"), "status": "running", "text": ""},
            replace=True,
        )
    if phase == "message":
        return ActivityDeltaEvent(
            type=EventType.ACTIVITY_DELTA,
            message_id=sid,
            activity_type=ACTIVITY_TYPE,
            patch=[{"op": "replace", "path": "/text", "value": value.get("text", "")}],
        )
    if phase == "finished":
        return ActivityDeltaEvent(
            type=EventType.ACTIVITY_DELTA,
            message_id=sid,
            activity_type=ACTIVITY_TYPE,
            patch=[{"op": "replace", "path": "/status", "value": value.get("status", "complete")}],
        )
    return None
