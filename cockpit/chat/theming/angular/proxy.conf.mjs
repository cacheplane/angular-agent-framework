// SPDX-License-Identifier: MIT
import { portsFor } from '../../../../cockpit/ports.mjs';

const { langgraph } = portsFor('cockpit-chat-theming-angular');

export default {
  "/api": {
    target: `http://localhost:${langgraph}`,
    secure: false,
    changeOrigin: true,
    pathRewrite: {"^/api":""},
    ws: true,
  },
};
