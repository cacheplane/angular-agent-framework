Add angular to my Angular 20+ application.

Install: npm install @cacheplane/langgraph@latest

1. In app.config.ts, add provideAgent({ apiUrl: 'http://localhost:2024' }) to the providers array. Import it from '@cacheplane/langgraph'.

2. Create a ChatComponent that calls agent<{ messages: BaseMessage[] }>({ assistantId: 'chat_agent' }) in the constructor or as a field initializer. agent() MUST be called inside an Angular injection context — constructor or field initializer is correct; ngOnInit is not.

3. The component template should loop over chat.messages() using @for and render each message's content. Add an input field and a button that calls chat.submit({ messages: [{ role: 'human', content: inputValue }] }).

4. In app.config.ts provideAgent call, the apiUrl should point to the LangGraph server. For local dev this is http://localhost:2024. For production use the LangGraph Platform URL from environment.ts.

The library is framework-integrated: no subscriptions, no async pipe needed — chat.messages() is an Angular Signal that updates token by token as the LLM responds.
