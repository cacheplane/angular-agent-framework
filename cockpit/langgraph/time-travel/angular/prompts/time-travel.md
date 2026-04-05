# LangGraph Time Travel (Angular)

This capability demonstrates LangGraph's time-travel feature — replaying or branching from any past checkpoint — using the `@cacheplane/chat` Angular component library. The `<chat-timeline-slider>` lets the user scrub through the full checkpoint history of a thread and fork execution from any historical state.

Key components used: `<chat>`, `<chat-timeline-slider>`. The slider reads checkpoint metadata from the thread state exposed by `streamResource` and emits a `checkpointId` that is passed back to the graph to resume from that point in history.
