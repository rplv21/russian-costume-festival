import type { APIRoute } from 'astro';
import { checkCredentials, createSession, ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_SEC } from '../../../lib/adminAuth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  if (typeof body !== 'object' || body === null) return json({ ok: false, error: 'bad_body' }, 400);
  const { username, password } = body as Record<string, unknown>;

  if (typeof username !== 'string' || typeof password !== 'string' || !checkCredentials(username, password)) {
    return json({ ok: false, error: 'invalid_credentials' }, 401);
  }

  const token = createSession();
  cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'strict',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SEC,
  });

  return json({ ok: true });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
