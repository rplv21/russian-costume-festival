import type { APIRoute } from 'astro';
import { destroySession, ADMIN_SESSION_COOKIE } from '../../../lib/adminAuth';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  const token = cookies.get(ADMIN_SESSION_COOKIE)?.value;
  destroySession(token);
  cookies.delete(ADMIN_SESSION_COOKIE, { path: '/' });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
