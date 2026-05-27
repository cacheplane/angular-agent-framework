// SPDX-License-Identifier: MIT
import { portsFor } from '../../../../cockpit/ports.mjs';

const { langgraph } = portsFor('cockpit-langgraph-durable-execution-angular');

export default {
  "/api": {
    target: `http://localhost:${langgraph}`,
    secure: false,
    changeOrigin: true,
    pathRewrite: {"^/api":""},
    ws: true,
  },
};
