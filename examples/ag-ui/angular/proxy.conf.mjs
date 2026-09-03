// Dev only: routes the relative /agent calls to the local uvicorn AG-UI server.
export default {
  '/agent': { target: 'http://localhost:8000', secure: false, changeOrigin: true, ws: true },
};
