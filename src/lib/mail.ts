import { festival, contacts } from '../data/site';

// Отправка через HTTP API (Resend), а не через SMTP: TimeWeb App Platform
// блокирует исходящие SMTP-подключения (проверено на портах 465 и 587 —
// оба одинаково зависают до тайм-аута), а обычный HTTPS-запрос порт не блокируется.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || `${festival.shortName} <bilety@kostum76.ru>`;

export function isMailConfigured(): boolean {
  return Boolean(RESEND_API_KEY);
}

export async function sendTicketsEmail(params: {
  to: string;
  dayLabel: string;
  bookingId: string;
  seatLabels: string[];
  pdfBytes: Uint8Array;
  pdfFileName: string;
}): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[mail] RESEND_API_KEY не задан (.env) — письмо не отправлено, PDF доступен только по кнопке скачивания.');
    return false;
  }

  const seatsList = params.seatLabels.map((label) => `• ${label}`).join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: params.to,
        subject: `Ваши билеты — ${festival.shortName}, ${params.dayLabel}`,
        text:
          `Здравствуйте!\n\n` +
          `Ваша бронь №${params.bookingId} на фестиваль «${festival.fullName}» подтверждена.\n\n` +
          `Дата:\n• ${params.dayLabel}.\n\n` +
          `Места:\n${seatsList}\n\n` +
          `Билеты — во вложении (PDF, тот же файл, что вы уже могли скачать на сайте). Возьмите с собой паспорт.\n\n` +
          `Если вы забронировали билеты, но не сможете посетить мероприятие — пожалуйста, сообщите об этом заранее: ` +
          `позвоните в Областной Дом народного творчества по номеру ${contacts.orgPhone} и попросите отменить бронь, ` +
          `чтобы места достались другим зрителям.\n\n` +
          `По всем вопросам обращайтесь в администрацию Ярославского Областного Дома народного творчества:\n` +
          `${contacts.orgPhone}, ${contacts.confirmationEmail}`,
        attachments: [
          {
            filename: params.pdfFileName,
            content: Buffer.from(params.pdfBytes).toString('base64'),
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error('[mail] Resend API вернул ошибку:', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[mail] Не удалось отправить письмо с билетами:', err);
    return false;
  }
}

export { contacts };
