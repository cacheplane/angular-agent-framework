"""LangGraphAgent subclass that converts subagent_activity CUSTOM events to
native AG-UI ACTIVITY events at the bridge's 1:1 dispatch point. Owned transport
adapter — keeps the wire protocol-native without patching the bridge."""
from ag_ui_langgraph import LangGraphAgent
from src.streaming.activity_transform import subagent_custom_to_activity


class ActivityEmittingAgent(LangGraphAgent):
    def _dispatch_event(self, event):
        activity = subagent_custom_to_activity(event)
        return super()._dispatch_event(activity if activity is not None else event)
