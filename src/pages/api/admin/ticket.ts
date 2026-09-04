import type { APIRoute } from 'astro';
import { isAdminRequest } from '../../../lib/adminAuth';
import { getOccupiedSeats } from '../../../lib/bookingStore';
import { isValidDay, SEAT_INDEX } from '../../../data/seating';
import { generateTicketsPdf, ticketsFileName } from '../../../lib/tickets';

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies }) => {
  if (!isAdminRequest(cookies)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const day = url.searchParams.get('day') ?? '';
  const seatId = url.searchParams.get('seatId') ?? '';
  if (!isValidDay(day)) return new Response('Bad day', { status: 400 });
  if (!SEAT_INDEX.has(seatId)) return new Response('Bad seat', { status: 400 });

  const rows = await getOccupiedSeats();
  const row = rows.find((r) => r.day === day && r.seatId === seatId);
  if (!row) return new Response('Not found', { status: 404 });

  const pdfBytes = await generateTicketsPdf([
    { dayLabel: row.dayLabel, seatId: row.seatId, name: row.name, bookingId: row.bookingId },
  ]);

  return new Response(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${ticketsFileName(row.bookingId)}"`,
      'Cache-Control': 'no-store',
    },
  });
};
