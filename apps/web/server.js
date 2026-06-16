/**
 * Custom Next.js server — wires the Twilio Media Stream WebSocket.
 *
 * Next.js (App Router) cannot serve WebSocket upgrades from a route handler, so
 * instrumentation.ts stashes the phone WS upgrade handler on
 * `globalThis.__triaji_phone_ws_handler` during `app.prepare()`. This server
 * forwards `upgrade` events on /api/phone/stream to that handler and delegates
 * every other upgrade (e.g. Next dev HMR) back to Next.
 *
 * IMPORTANT: the phone call-center voice pipeline only works when the app is
 * launched through THIS server. Plain `next start` / `next dev` do not handle the
 * WebSocket upgrade.
 *   - production:        `pnpm --filter @triaji/web start`   (NODE_ENV=production node server.js)
 *   - local call test:   `pnpm --filter @triaji/web dev:phone` (node server.js, dev mode)
 *
 * Twilio must be configured to stream to wss://<host>/api/phone/stream (see the
 * TwiML built in app/api/phone/incoming/route.ts).
 */
const { createServer } = require('node:http');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const PHONE_WS_PATH = '/api/phone/stream';

const app = next({ dev, hostname, port });

app.prepare().then(() => {
  const handle = app.getRequestHandler();
  // Next's own upgrade handler (HMR in dev); must be obtained after prepare().
  const upgradeHandle =
    typeof app.getUpgradeHandler === 'function' ? app.getUpgradeHandler() : null;

  const server = createServer((req, res) => handle(req, res));

  server.on('upgrade', (req, socket, head) => {
    const url = req.url || '';

    if (url.startsWith(PHONE_WS_PATH)) {
      // Registered by instrumentation.ts during app.prepare().
      const phoneWs = globalThis.__triaji_phone_ws_handler;
      if (typeof phoneWs === 'function') {
        phoneWs(req, socket, head);
      } else {
        console.error(
          '[server] Twilio phone WS handler not registered — is instrumentation.ts running? Closing upgrade.'
        );
        socket.destroy();
      }
      return;
    }

    // Everything else (Next dev HMR, etc.)
    if (upgradeHandle) {
      upgradeHandle(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  server.listen(port, () => {
    console.log(
      `> Triaji web ready on http://${hostname}:${port}  (phone WS: ${PHONE_WS_PATH}, dev=${dev})`
    );
  });
});
