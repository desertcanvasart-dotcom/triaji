/**
 * Mock HIS HTTP Server
 *
 * Mimics a Shifa-style REST API for local development and integration testing.
 * Run: pnpm --filter @triaji/his-adapters mock-server
 * Starts on http://localhost:4000
 *
 * Authentication: X-API-Key header must be "test-api-key"
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { MOCK_HIS_DOCTORS, generateSlots, hisBookings } from './data.js';

const PORT = 4000;
const TEST_API_KEY = 'test-api-key';

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

function json(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function checkAuth(req: IncomingMessage, res: ServerResponse): boolean {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== TEST_API_KEY) {
    json(res, { error: 'Invalid API key' }, 401);
    return false;
  }
  return true;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method = req.method ?? 'GET';

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ─── Routes ─────────────────────────────────────────────────────

  // GET /api/v1/system/ping
  if (pathname === '/api/v1/system/ping' && method === 'GET') {
    if (!checkAuth(req, res)) return;
    json(res, { status: 'ok', version: 'shifa-mock-v3.2.1' });
    return;
  }

  // GET /api/v1/doctors
  if (pathname === '/api/v1/doctors' && method === 'GET') {
    if (!checkAuth(req, res)) return;
    json(res, MOCK_HIS_DOCTORS);
    return;
  }

  // GET /api/v1/doctors/:id/slots
  const slotsMatch = pathname.match(/^\/api\/v1\/doctors\/([^/]+)\/slots$/);
  if (slotsMatch && method === 'GET') {
    if (!checkAuth(req, res)) return;
    const doctorId = slotsMatch[1]!;
    const from = url.searchParams.get('from') ?? new Date().toISOString();
    const to = url.searchParams.get('to') ?? (() => {
      const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString();
    })();
    const slots = generateSlots(doctorId, from, to);
    json(res, slots);
    return;
  }

  // POST /api/v1/appointments
  if (pathname === '/api/v1/appointments' && method === 'POST') {
    if (!checkAuth(req, res)) return;
    const body = await parseBody(req);
    const ref = `SHIFA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    hisBookings.set(ref, {
      booking_ref: ref,
      slot_id: String(body['slot_id'] ?? ''),
      doctor_id: String(body['doctor_id'] ?? ''),
      patient_name_ar: String(body['patient_name_ar'] ?? ''),
      patient_phone: String(body['patient_phone'] ?? ''),
      status: 'confirmed',
      external_ref: String(body['external_ref'] ?? ''),
    });
    json(res, { booking_ref: ref, status: 'confirmed' }, 201);
    return;
  }

  // PUT /api/v1/appointments/:ref/cancel
  const cancelMatch = pathname.match(/^\/api\/v1\/appointments\/([^/]+)\/cancel$/);
  if (cancelMatch && method === 'PUT') {
    if (!checkAuth(req, res)) return;
    const ref = cancelMatch[1]!;
    const booking = hisBookings.get(ref);
    if (!booking) {
      json(res, { error: 'Booking not found' }, 404);
      return;
    }
    booking.status = 'cancelled';
    json(res, { status: 'cancelled' });
    return;
  }

  // 404
  json(res, { error: 'Not found' }, 404);
});

server.listen(PORT, () => {
  console.log(`🏥 Mock HIS Server running on http://localhost:${PORT}`);
  console.log('   API Key: test-api-key');
  console.log('   Endpoints:');
  console.log('     GET  /api/v1/system/ping');
  console.log('     GET  /api/v1/doctors');
  console.log('     GET  /api/v1/doctors/:id/slots?from=&to=');
  console.log('     POST /api/v1/appointments');
  console.log('     PUT  /api/v1/appointments/:ref/cancel');
});
