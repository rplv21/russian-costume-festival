import type { APIRoute } from 'astro';
import { isValidDay, SEAT_INDEX, MAX_SEATS_PER_BOOKING, FREE_DAYS, seatLabel } from '../../data/seating';
import { reserveSeats } from '../../lib/bookingStore';
import { generateTicketsPdf, ticketsFileName } from '../../lib/tickets';
import { sendTicketsEmail, isMailConfigured } from '../../lib/mail';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isFullName(value: string): boolean {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2 && parts.every((p) => p.length >= 2);
}

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  if (typeof body !== 'object' || body === null) return json({ ok: false, error: 'bad_body' }, 400);
  const { day, seatIds, name, email, phone, consent } = body as Record<string, unknown>;

  if (!isValidDay(day)) return json({ ok: false, error: 'invalid_day' }, 400);

  if (!Array.isArray(seatIds) || seatIds.length === 0 || seatIds.length > MAX_SEATS_PER_BOOKING) {
    return json({ ok: false, error: 'invalid_seat_count' }, 400);
  }
  const uniqueSeatIds = Array.from(new Set(seatIds));
  if (uniqueSeatIds.length !== seatIds.length) return json({ ok: false, error: 'duplicate_seats' }, 400);
  for (const id of uniqueSeatIds) {
    if (typeof id !== 'string' || !SEAT_INDEX.has(id)) return json({ ok: false, error: 'unknown_seat', seatId: id }, 400);
  }

  if (typeof name !== 'string' || !isFullName(name)) {
    return json({ ok: false, error: 'invalid_name' }, 400);
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return json({ ok: false, error: 'invalid_email' }, 400);
  }
  if (typeof phone !== 'string' || phone.replace(/\D/g, '').length < 10) {
    return json({ ok: false, error: 'invalid_phone' }, 400);
  }
  if (consent !== true) {
    return json({ ok: false, error: 'consent_required' }, 400);
  }

  const cleanName = name.trim().replace(/\s+/g, ' ');
  const cleanEmail = email.trim();
  const cleanPhone = phone.trim();
  const seatIdList = uniqueSeatIds as string[];

  const reserved = await reserveSeats({
    day,
    seatIds: seatIdList,
    name: cleanName,
    email: cleanEmail,
    phone: cleanPhone,
    enforcePersonLimit: true,
  });
  if (!reserved.ok) {
    if (reserved.reason === 'person_limit') {
      return json(
        { ok: false, error: 'person_limit', alreadyBooked: reserved.alreadyBooked, limit: MAX_SEATS_PER_BOOKING },
        409,
      );
    }
    return json({ ok: false, error: 'seats_taken', takenSeatIds: reserved.takenSeatIds }, 409);
  }

  const dayLabel = FREE_DAYS.find((d) => d.value === day)?.label ?? day;
  const pdfBytes = await generateTicketsPdf(
    seatIdList.map((seatId) => ({ dayLabel, seatId, name: cleanName, bookingId: reserved.bookingId })),
  );
  const fileName = ticketsFileName(reserved.bookingId);

  let emailSent = false;
  if (isMailConfigured()) {
    emailSent = await sendTicketsEmail({
      to: cleanEmail,
      name: cleanName,
      dayLabel,
      bookingId: reserved.bookingId,
      seatLabels: seatIdList.map((seatId) => seatLabel(seatId)),
      pdfBytes,
      pdfFileName: fileName,
    });
  }

  return json({
    ok: true,
    bookingId: reserved.bookingId,
    pdfBase64: Buffer.from(pdfBytes).toString('base64'),
    pdfFileName: fileName,
    emailSent,
    mailConfigured: isMailConfigured(),
  });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
