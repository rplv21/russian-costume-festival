import crypto from 'node:crypto';

// Логин/пароль читаются из .env (ADMIN_USERNAME/ADMIN_PASSWORD), со значениями
// по умолчанию — на случай, если .env ещё не настроен на сервере.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'domnaroda';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'russiykostum_213442';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 часов
const SESSION_COOKIE = 'admin_session';

// Сессии живут в памяти процесса — для одного Node-сервера этого достаточно;
// при рестарте сервера админу нужно будет войти заново.
const sessions = new Map<string, number>();

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function checkCredentials(username: string, password: string): boolean {
  return timingSafeEqual(username, ADMIN_USERNAME) && timingSafeEqual(password, ADMIN_PASSWORD);
}

export function createSession(): string {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

export function isValidSession(token: string | undefined | null): boolean {
  if (!token) return false;
  const expiresAt = sessions.get(token);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function destroySession(token: string | undefined | null): void {
  if (token) sessions.delete(token);
}

export const ADMIN_SESSION_COOKIE = SESSION_COOKIE;
export const ADMIN_SESSION_MAX_AGE_SEC = SESSION_TTL_MS / 1000;

export function isAdminRequest(cookies: { get(name: string): { value: string } | undefined }): boolean {
  return isValidSession(cookies.get(SESSION_COOKIE)?.value);
}
