import type { APIRoute } from 'astro';
import { isAdminRequest } from '../../../lib/adminAuth';
import { getOccupiedSeats } from '../../../lib/bookingStore';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminRequest(cookies)) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rows = await getOccupiedSeats();
  return new Response(JSON.stringify({ ok: true, rows }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
