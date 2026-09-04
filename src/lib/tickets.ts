import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { festival, contacts } from '../data/site';
import { seatLabel, VENUE, VIEWBOX } from '../data/seating';

const PROJECT_ROOT = process.cwd();

export type TicketInfo = {
  dayLabel: string;
  seatId: string;
  name: string;
  bookingId: string;
};

const RED = rgb(0.886, 0.039, 0.09);
const BLUE = rgb(0.153, 0.204, 0.459);
const TEXT = rgb(0.102, 0.102, 0.122);
const MUTED = rgb(0.333, 0.337, 0.373);
const WHITE = rgb(1, 1, 1);
const SURFACE = rgb(0.969, 0.965, 0.953);
const BORDER = rgb(0.85, 0.85, 0.86);
const DOT_MUTED = rgb(0.79, 0.8, 0.82);
const STAGE_FILL = rgb(0.886, 0.902, 0.918);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 28;
const GAP = 16;

type Fonts = { regular: PDFFont; bold: PDFFont };
type Images = { doll: PDFImage };

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawMiniMap(
  page: PDFPage,
  box: { x: number; y: number; w: number; h: number },
  seatId: string,
  fonts: Fonts,
) {
  const scale = box.w / VIEWBOX.width;
  const top = box.y + box.h; // верх области, откуда откладываем схему вниз

  page.drawText('СХЕМА ЗАЛА', {
    x: box.x,
    y: top - 8,
    size: 7,
    font: fonts.bold,
    color: MUTED,
  });

  const originY = top - 18;
  const toX = (sx: number) => box.x + sx * scale;
  const toY = (sy: number) => originY - sy * scale;

  // сцена
  page.drawRectangle({
    x: toX(359),
    y: toY(90),
    width: 612 * scale,
    height: 40 * scale,
    color: STAGE_FILL,
  });

  for (const section of VENUE) {
    for (const seat of section.seats) {
      const isTarget = seat.id === seatId;
      page.drawCircle({
        x: toX(seat.x),
        y: toY(seat.y),
        size: isTarget ? 2.4 : 0.9,
        color: isTarget ? RED : DOT_MUTED,
      });
    }
  }
}

function drawDoll(page: PDFPage, box: { x: number; y: number; w: number; h: number }, doll: PDFImage) {
  const ratio = Math.min(box.w / doll.width, box.h / doll.height);
  const w = doll.width * ratio;
  const h = doll.height * ratio;
  page.drawImage(doll, {
    x: box.x + (box.w - w) / 2,
    y: box.y + (box.h - h) / 2,
    width: w,
    height: h,
  });
}

function drawDashedLine(page: PDFPage, x1: number, y: number, x2: number) {
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness: 1,
    color: BORDER,
    dashArray: [4, 4],
  });
}

function drawTicket(
  page: PDFPage,
  box: { x: number; y: number; w: number; h: number },
  ticket: TicketInfo,
  fonts: Fonts,
  images: Images,
) {
  const { x, y, w, h } = box;

  // фон + рамка
  page.drawRectangle({ x, y, width: w, height: h, color: WHITE, borderColor: BORDER, borderWidth: 1 });

  const headerH = 64;
  page.drawRectangle({ x, y: y + h - headerH, width: w, height: headerH, color: BLUE });

  page.drawText(festival.shortName, {
    x: x + 20,
    y: y + h - 32,
    size: 18,
    font: fonts.bold,
    color: WHITE,
  });
  const ticketLabel = 'БИЛЕТ';
  const ticketLabelW = fonts.bold.widthOfTextAtSize(ticketLabel, 11);
  page.drawText(ticketLabel, {
    x: x + w - 20 - ticketLabelW,
    y: y + h - 24,
    size: 11,
    font: fonts.bold,
    color: WHITE,
  });
  page.drawText(festival.dates.label, {
    x: x + 20,
    y: y + h - headerH + 12,
    size: 9.5,
    font: fonts.regular,
    color: rgb(0.85, 0.87, 0.95),
  });

  // Полоса-акцент под шапкой
  page.drawRectangle({ x, y: y + h - headerH - 3, width: w, height: 3, color: RED });

  const bodyTop = y + h - headerH - 3;
  const contentX = x + 20;
  const contentW = w - 40;
  const mapColW = 150;
  const textColW = contentW - mapColW - 16;
  let cursorY = bodyTop - 22;

  function field(label: string, value: string, opts: { size?: number; color?: typeof RED; bold?: boolean } = {}) {
    page.drawText(label.toUpperCase(), {
      x: contentX,
      y: cursorY,
      size: 7.5,
      font: fonts.bold,
      color: MUTED,
    });
    cursorY -= 15;
    const lines = wrapText(value, opts.bold ? fonts.bold : fonts.regular, opts.size ?? 13, textColW);
    for (const line of lines) {
      page.drawText(line, {
        x: contentX,
        y: cursorY,
        size: opts.size ?? 13,
        font: opts.bold ? fonts.bold : fonts.regular,
        color: opts.color ?? TEXT,
      });
      cursorY -= (opts.size ?? 13) + 5;
    }
    cursorY -= 6;
  }

  field('День фестиваля', ticket.dayLabel, { bold: true, color: BLUE, size: 13 });
  field('Место', seatLabel(ticket.seatId), { bold: true, color: RED, size: 14 });
  field('Гость', ticket.name, { size: 12 });

  const mapBoxX = contentX + textColW + 16;
  const mapBoxTop = bodyTop - 22;
  const mapBoxBottom = y + 64;
  drawMiniMap(page, { x: mapBoxX, y: mapBoxBottom, w: mapColW, h: mapBoxTop - mapBoxBottom }, ticket.seatId, fonts);

  // Кукла — в оставшемся месте левой колонки, под полями и над предупреждением
  const dollBoxBottom = y + 64;
  const dollBoxTop = cursorY - 4;
  if (dollBoxTop > dollBoxBottom) {
    drawDoll(page, { x: contentX, y: dollBoxBottom, w: textColW, h: dollBoxTop - dollBoxBottom }, images.doll);
  }

  // Предупреждение о паспорте
  const warnBoxY = y + 34;
  page.drawRectangle({
    x: contentX,
    y: warnBoxY,
    width: contentW,
    height: 22,
    color: SURFACE,
  });
  page.drawText('При посещении необходимо иметь при себе паспорт', {
    x: contentX + 8,
    y: warnBoxY + 7,
    size: 8.5,
    font: fonts.bold,
    color: RED,
  });

  // Нижняя строка: место проведения + № брони
  const venue = festival.venues[0];
  page.drawText(venue.name.replace(/\n/g, ' '), {
    x: contentX,
    y: y + 16,
    size: 7.5,
    font: fonts.regular,
    color: MUTED,
  });
  const bookingText = `№ ${ticket.bookingId}`;
  const bookingW = fonts.regular.widthOfTextAtSize(bookingText, 7.5);
  page.drawText(bookingText, {
    x: x + w - 20 - bookingW,
    y: y + 16,
    size: 7.5,
    font: fonts.regular,
    color: MUTED,
  });
}

export async function generateTicketsPdf(tickets: TicketInfo[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const [montRegularBytes, montBoldBytes, dollBytes] = await Promise.all([
    fs.readFile(path.join(PROJECT_ROOT, 'src/assets/fonts/Montserrat-Regular.ttf')),
    fs.readFile(path.join(PROJECT_ROOT, 'src/assets/fonts/Montserrat-Bold.ttf')),
    fs.readFile(path.join(PROJECT_ROOT, 'src/assets/images/doll-main.png')),
  ]);

  const fonts: Fonts = {
    regular: await pdfDoc.embedFont(montRegularBytes, { subset: true }),
    bold: await pdfDoc.embedFont(montBoldBytes, { subset: true }),
  };
  const images: Images = {
    doll: await pdfDoc.embedPng(dollBytes),
  };

  const ticketH = (PAGE_H - MARGIN * 2 - GAP) / 2;
  const ticketW = PAGE_W - MARGIN * 2;

  for (let i = 0; i < tickets.length; i += 2) {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    const pair = [tickets[i], tickets[i + 1]].filter(Boolean) as TicketInfo[];
    pair.forEach((ticket, idx) => {
      const boxY = PAGE_H - MARGIN - (idx + 1) * ticketH - idx * GAP;
      drawTicket(page, { x: MARGIN, y: boxY, w: ticketW, h: ticketH }, ticket, fonts, images);
    });
    if (pair.length === 2) {
      const cutY = PAGE_H - MARGIN - ticketH - GAP / 2;
      drawDashedLine(page, MARGIN, cutY, PAGE_W - MARGIN);
    }
  }

  return pdfDoc.save();
}

export function ticketsFileName(bookingId: string): string {
  return `bilety-russkiy-kostyum-${bookingId}.pdf`;
}

export { contacts };
