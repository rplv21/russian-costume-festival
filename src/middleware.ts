import type { MiddlewareHandler } from 'astro';

// Базовые security-заголовки. Почти всё самохостится, кроме Яндекс.Метрики
// (script-src/img-src/connect-src отдельно разрешают её домен для счётчика,
// пикселя noscript и фоновых запросов отправки статистики).
export const onRequest: MiddlewareHandler = async (_context, next) => {
  const response = await next();

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' data: https://mc.yandex.ru",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' https://mc.yandex.ru",
      "connect-src 'self' https://mc.yandex.ru",
      "font-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
    ].join('; '),
  );

  return response;
};
