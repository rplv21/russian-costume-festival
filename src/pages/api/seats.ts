import type { APIRoute } from 'astro';
import { isValidDay } from '../../data/seating';
import { getBookedSeats } from '../../lib/bookingStore';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const day = url.searchParams.get('day') ?? '';
  if (!isValidDay(day)) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_day' }), { status: 400 });
  }
  const bookedSeatIds = await getBookedSeats(day);
  return new Response(JSON.stringify({ ok: true, day, bookedSeatIds }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
