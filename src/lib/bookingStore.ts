import { promises as fs } from 'node:fs';
import path from 'node:path';
import { FREE_DAYS, seatLabel } from '../data/seating';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'bookings.json');

type StoreShape = {
  bookedSeats: Record<string, string[]>;
  bookings: Array<{
    id: string;
    day: string;
    seatIds: string[];
    name: string;
    email: string;
    phone: string;
    createdAt: string;
  }>;
};

function emptyStore(): StoreShape {
  const bookedSeats: Record<string, string[]> = {};
  for (const day of FREE_DAYS) bookedSeats[day.value] = [];
  return { bookedSeats, bookings: [] };
}

async function readStore(): Promise<StoreShape> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as StoreShape;
    for (const day of FREE_DAYS) {
      if (!parsed.bookedSeats[day.value]) parsed.bookedSeats[day.value] = [];
    }
    return parsed;
  } catch {
    return emptyStore();
  }
}

async function writeStore(store: StoreShape): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

// Простая последовательная очередь — не даёт двум одновременным запросам
// прочитать один и тот же файл до того, как первый допишет своё бронирование.
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

export async function getBookedSeats(day: string): Promise<string[]> {
  const store = await readStore();
  return store.bookedSeats[day] ?? [];
}

export type ReserveResult =
  | { ok: true; bookingId: string }
  | { ok: false; reason: 'taken'; takenSeatIds: string[] };

export function reserveSeats(params: {
  day: string;
  seatIds: string[];
  name: string;
  email: string;
  phone: string;
}): Promise<ReserveResult> {
  return serialize(async () => {
    const store = await readStore();
    const booked = new Set(store.bookedSeats[params.day] ?? []);
    const takenSeatIds = params.seatIds.filter((id) => booked.has(id));

    if (takenSeatIds.length > 0) {
      // Повторная отправка той же формы (например, клиент не получил ответ на
      // первую попытку из-за сетевого сбоя, хотя бронь уже сохранилась) не
      // должна выглядеть как отказ: если ВСЕ запрошенные места целиком
      // совпадают с одной существующей бронью на тот же email — возвращаем
      // её же id вместо создания дубликата или ошибки "места заняты".
      const seatSet = new Set(params.seatIds);
      const existing = store.bookings.find(
        (b) =>
          b.day === params.day &&
          b.email.trim().toLowerCase() === params.email.trim().toLowerCase() &&
          b.seatIds.length === seatSet.size &&
          b.seatIds.every((id) => seatSet.has(id)),
      );
      if (existing) {
        return { ok: true, bookingId: existing.id } as const;
      }
      return { ok: false, reason: 'taken', takenSeatIds } as const;
    }

    for (const id of params.seatIds) booked.add(id);
    store.bookedSeats[params.day] = Array.from(booked);

    const bookingId = `RK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    store.bookings.push({
      id: bookingId,
      day: params.day,
      seatIds: params.seatIds,
      name: params.name,
      email: params.email,
      phone: params.phone,
      createdAt: new Date().toISOString(),
    });

    await writeStore(store);
    return { ok: true, bookingId } as const;
  });
}

export type OccupiedSeat = {
  day: string;
  dayLabel: string;
  seatId: string;
  seatLabel: string;
  bookingId: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
};

export async function getOccupiedSeats(): Promise<OccupiedSeat[]> {
  const store = await readStore();
  const rows: OccupiedSeat[] = [];
  for (const booking of store.bookings) {
    const dayLabel = FREE_DAYS.find((d) => d.value === booking.day)?.label ?? booking.day;
    for (const seatId of booking.seatIds) {
      rows.push({
        day: booking.day,
        dayLabel,
        seatId,
        seatLabel: seatLabel(seatId),
        bookingId: booking.id,
        name: booking.name,
        email: booking.email,
        phone: booking.phone ?? '',
        createdAt: booking.createdAt,
      });
    }
  }
  rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return rows;
}

export type ReleaseResult = { ok: true } | { ok: false; reason: 'not_found' };

export function releaseSeat(day: string, seatId: string): Promise<ReleaseResult> {
  return serialize(async () => {
    const store = await readStore();
    const booked = store.bookedSeats[day] ?? [];
    if (!booked.includes(seatId)) {
      return { ok: false, reason: 'not_found' } as const;
    }
    store.bookedSeats[day] = booked.filter((id) => id !== seatId);

    for (const booking of store.bookings) {
      if (booking.day !== day) continue;
      const idx = booking.seatIds.indexOf(seatId);
      if (idx !== -1) booking.seatIds.splice(idx, 1);
    }
    store.bookings = store.bookings.filter((b) => b.seatIds.length > 0);

    await writeStore(store);
    return { ok: true } as const;
  });
}
