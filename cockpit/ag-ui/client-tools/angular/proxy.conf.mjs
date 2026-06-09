// SPDX-License-Identifier: MIT
import { portsFor } from '../../../../cockpit/ports.mjs';
const { langgraph: backend } = portsFor('cockpit-ag-ui-client-tools-angular');
export default {
  '/agent': { target: `http://localhost:${backend}`, secure: false, changeOrigin: true, ws: true },
};
