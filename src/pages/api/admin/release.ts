import type { APIRoute } from 'astro';
import { isAdminRequest } from '../../../lib/adminAuth';
import { releaseSeat } from '../../../lib/bookingStore';
import { isValidDay, SEAT_INDEX } from '../../../data/seating';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminRequest(cookies)) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  if (typeof body !== 'object' || body === null) return json({ ok: false, error: 'bad_body' }, 400);
  const { day, seatId } = body as Record<string, unknown>;

  if (!isValidDay(day)) return json({ ok: false, error: 'invalid_day' }, 400);
  if (typeof seatId !== 'string' || !SEAT_INDEX.has(seatId)) return json({ ok: false, error: 'unknown_seat' }, 400);

  const result = await releaseSeat(day, seatId);
  if (!result.ok) return json({ ok: false, error: result.reason }, 404);

  return json({ ok: true });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
