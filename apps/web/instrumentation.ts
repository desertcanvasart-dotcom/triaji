/**
 * Next.js Instrumentation Hook
 *
 * Runs once when the Next.js server starts. Used to attach the
 * WebSocket server for Twilio Media Streams to the Node.js HTTP server.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 * @see lib/phone/ws-server.ts for the WebSocket handler
 */

export async function register() {
  // Only run server-side (not in Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Registering server-side hooks...');

    // Attach WebSocket upgrade handler for Twilio Media Streams
    // The actual HTTP server attachment happens when Next.js starts listening.
    // We use process.on to hook into the server lifecycle.
    const { handleWebSocketUpgrade } = await import('./lib/phone/ws-server');

    // Next.js does not expose the HTTP server directly in instrumentation.
    // We store the handler globally so it can be attached via a custom server
    // or middleware that has access to the HTTP server's 'upgrade' event.
    const globalRef = globalThis as GlobalWithPhoneWs;
    globalRef.__triaji_phone_ws_handler = handleWebSocketUpgrade;

    console.log('[Instrumentation] Phone WebSocket handler registered');
    console.log('[Instrumentation] Attach to HTTP server upgrade event in custom server or middleware');
  }
}

/**
 * Global type extension for the WebSocket handler reference.
 * This allows the custom server (server.ts) to access the handler.
 */
interface GlobalWithPhoneWs {
  __triaji_phone_ws_handler?: typeof import('./lib/phone/ws-server').handleWebSocketUpgrade;
}
