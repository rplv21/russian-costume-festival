import type { APIRoute } from 'astro';
import { isAdminRequest } from '../../../lib/adminAuth';
import { getOccupiedSeats } from '../../../lib/bookingStore';
import { buildXlsx } from '../../../lib/xlsxWriter';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminRequest(cookies)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const rows = await getOccupiedSeats();
  const header = ['День', 'Место', 'ФИО', 'Телефон', 'Email', 'Дата и время брони', '№ брони'];
  const dataRows = rows.map((row) => [
    row.dayLabel,
    row.seatLabel,
    row.name,
    row.phone,
    row.email,
    new Date(row.createdAt).toLocaleString('ru-RU'),
    row.bookingId,
  ]);

  const xlsx = buildXlsx('Бронирования', header, dataRows);

  return new Response(new Uint8Array(xlsx), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="bronirovaniya-russkiy-kostyum.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
};
