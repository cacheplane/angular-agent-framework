declare module '*.mjs' {
  const app: {
    fetch(request: Request): Response | Promise<Response>;
  };
  export default app;
}
