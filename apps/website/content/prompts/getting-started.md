Add angular to my Angular 20+ application.

Install: npm install @threadplane/chat @threadplane/langgraph @langchain/core @langchain/langgraph-sdk marked

1. In app.config.ts, add provideAgent({ apiUrl: 'http://localhost:2024', assistantId: 'chat' }) to the providers array. Import it from '@threadplane/langgraph'.

2. Create a component that imports ChatComponent from '@threadplane/chat' and calls injectAgent() in the constructor or as a field initializer. injectAgent() MUST be called inside an Angular injection context — constructor or field initializer is correct; ngOnInit is not.

3. The component template can start with <chat [agent]="chat" />. For custom layouts, loop over chat.messages() with @for and call chat.submit({ message: inputValue }) from your input.

4. In app.config.ts provideAgent call, the apiUrl should point to the LangGraph server. For local dev this is http://localhost:2024. For production use the LangGraph Platform URL from environment.ts.

The library is framework-integrated: no subscriptions, no async pipe needed — chat.messages() is an Angular Signal that updates token by token as the LLM responds.
