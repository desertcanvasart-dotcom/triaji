/**
 * GET /api/phone/stream
 *
 * This route exists as a documentation endpoint only.
 * The actual Twilio Media Stream WebSocket handling is done via
 * the custom WebSocket server in lib/phone/ws-server.ts, which
 * is attached to the Node.js HTTP server via instrumentation.ts.
 *
 * Twilio connects to this path using wss:// protocol.
 * If reached via HTTP GET, we return a 426 Upgrade Required response.
 */

export async function GET() {
  return new Response(
    JSON.stringify({
      error: 'WebSocket upgrade required',
      message:
        'هذا المسار يتعامل مع Twilio Media Streams عبر WebSocket. يجب الاتصال عبر بروتوكول wss://',
      docs: {
        protocol: 'wss://',
        path: '/api/phone/stream',
        handler: 'lib/phone/ws-server.ts',
        events: ['connected', 'start', 'media', 'dtmf', 'stop'],
      },
    }),
    {
      status: 426,
      headers: {
        'Content-Type': 'application/json',
        Upgrade: 'websocket',
      },
    }
  );
}
