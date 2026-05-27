// SPDX-License-Identifier: MIT
import { portsFor } from '../../../../cockpit/ports.mjs';

const { langgraph } = portsFor('cockpit-render-spec-rendering-angular');

export default {
  "/api": {
    target: `http://localhost:${langgraph}`,
    secure: false,
    changeOrigin: true,
    pathRewrite: {"^/api":""},
    ws: true,
  },
};
