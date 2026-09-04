import type { APIRoute } from 'astro';
import { isAdminRequest } from '../../../lib/adminAuth';
import { reserveSeats } from '../../../lib/bookingStore';
import { isValidDay, SEAT_INDEX, FREE_DAYS, seatLabel } from '../../../data/seating';

export const prerender = false;

const DEFAULT_NAME = 'Занято администратором';

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
  const { day, seatIds, name } = body as Record<string, unknown>;

  if (!isValidDay(day)) return json({ ok: false, error: 'invalid_day' }, 400);
  if (!Array.isArray(seatIds) || seatIds.length === 0) return json({ ok: false, error: 'invalid_seat_count' }, 400);
  const uniqueSeatIds = Array.from(new Set(seatIds));
  if (uniqueSeatIds.length !== seatIds.length) return json({ ok: false, error: 'duplicate_seats' }, 400);
  for (const id of uniqueSeatIds) {
    if (typeof id !== 'string' || !SEAT_INDEX.has(id)) return json({ ok: false, error: 'unknown_seat', seatId: id }, 400);
  }
  const seatIdList = uniqueSeatIds as string[];

  const cleanName =
    typeof name === 'string' && name.trim() ? name.trim().replace(/\s+/g, ' ').slice(0, 120) : DEFAULT_NAME;

  const result = await reserveSeats({ day, seatIds: seatIdList, name: cleanName, email: '', phone: '' });
  if (!result.ok) return json({ ok: false, error: 'seats_taken', takenSeatIds: result.takenSeatIds }, 409);

  const dayLabel = FREE_DAYS.find((d) => d.value === day)?.label ?? day;
  const createdAt = new Date().toISOString();
  const rows = seatIdList.map((seatId) => ({
    day,
    dayLabel,
    seatId,
    seatLabel: seatLabel(seatId),
    bookingId: result.bookingId,
    name: cleanName,
    email: '',
    phone: '',
    createdAt,
  }));

  return json({ ok: true, rows });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
