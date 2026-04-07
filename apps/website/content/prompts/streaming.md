Configure token-by-token streaming in my Angular component that uses angular.

The component already has agent() set up. Now:

1. In the template, bind to chat.messages() with @for — each BaseMessage has a .content property. The template re-renders automatically as tokens arrive because messages() is a Signal.

2. Show a loading indicator while streaming: use chat.isLoading() in an @if block.

3. To throttle rapid re-renders (if performance is a concern), pass throttle: 50 to agent() options — this throttles Signal updates to at most one per 50ms while preserving the final value.

4. To show the stream status more precisely, bind to chat.status() which returns 'idle' | 'loading' | 'resolved' | 'error'.

Do not use async pipe or subscribe() — the signals update automatically.
