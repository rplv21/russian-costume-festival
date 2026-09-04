import nodemailer from 'nodemailer';
import { festival, contacts } from '../data/site';

// Настройки почты берутся из переменных окружения (.env, не попадает в git).
// Пока SMTP не настроен — письма не отправляются, но бронирование и PDF всё
// равно работают: пользователь получает билеты через кнопку скачивания.
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

export function isMailConfigured(): boolean {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
function getTransporter() {
  if (!transporter && isMailConfigured()) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendTicketsEmail(params: {
  to: string;
  name: string;
  dayLabel: string;
  bookingId: string;
  pdfBytes: Uint8Array;
  pdfFileName: string;
}): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    console.warn('[mail] SMTP не настроен (.env: SMTP_HOST/SMTP_USER/SMTP_PASS) — письмо не отправлено, PDF доступен только по кнопке скачивания.');
    return false;
  }

  try {
    await t.sendMail({
      from: `"${festival.shortName}" <${SMTP_FROM}>`,
      to: params.to,
      subject: `Ваши билеты — ${festival.shortName}, ${params.dayLabel}`,
      text:
        `Здравствуйте, ${params.name}!\n\n` +
        `Ваша бронь №${params.bookingId} на фестиваль «${festival.fullName}» подтверждена.\n` +
        `День: ${params.dayLabel}.\n\n` +
        `Билеты — во вложении (PDF). Возьмите с собой паспорт.\n\n` +
        `По вопросам: ${contacts.orgPhone}, ${contacts.confirmationEmail}`,
      attachments: [
        {
          filename: params.pdfFileName,
          content: Buffer.from(params.pdfBytes),
          contentType: 'application/pdf',
        },
      ],
    });
    return true;
  } catch (err) {
    console.error('[mail] Не удалось отправить письмо с билетами:', err);
    return false;
  }
}
