import { promises as fs } from 'node:fs';
import path from 'node:path';
import { FREE_DAYS, seatLabel, MAX_SEATS_PER_BOOKING } from '../data/seating';

function normalizedPhone(phone: string | undefined | null): string {
  // Записи, созданные до появления поля phone (или ручные брони из
  // админки), могут не иметь его вовсе — не должно валить сравнение.
  return (phone ?? '').replace(/\D/g, '');
}

// Локальный файл — фоллбек для разработки (npm run dev) и на случай, если
// GITHUB_DATA_TOKEN не задан. В проде TimeWeb App Platform не даёт
// постоянного диска: контейнер (и этот файл вместе с ним) пересоздаётся с
// нуля при каждом деплое, поэтому реальное хранилище — приватный GitHub-
// репозиторий (см. ниже), переживающий любые передеплои сайта.
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'bookings.json');

const GITHUB_TOKEN = process.env.GITHUB_DATA_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_DATA_OWNER || 'rplv21';
const GITHUB_REPO = process.env.GITHUB_DATA_REPO || 'russian-costume-festival-data';
const GITHUB_BRANCH = process.env.GITHUB_DATA_BRANCH || 'main';
const GITHUB_FILE_PATH = 'bookings.json';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;

function githubEnabled(): boolean {
  return Boolean(GITHUB_TOKEN);
}

if (process.env.NODE_ENV === 'production' && !githubEnabled()) {
  console.warn(
    '[bookingStore] GITHUB_DATA_TOKEN не задан в проде — брони пишутся в файл внутри контейнера ' +
      'и будут потеряны при следующем деплое. Задайте GITHUB_DATA_TOKEN в переменных окружения TimeWeb.',
  );
}

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

type LoadedStore = { store: StoreShape; sha?: string };

function emptyStore(): StoreShape {
  const bookedSeats: Record<string, string[]> = {};
  for (const day of FREE_DAYS) bookedSeats[day.value] = [];
  return { bookedSeats, bookings: [] };
}

function fillMissingDays(store: StoreShape): StoreShape {
  for (const day of FREE_DAYS) {
    if (!store.bookedSeats[day.value]) store.bookedSeats[day.value] = [];
  }
  return store;
}

async function readStoreFromGithub(): Promise<LoadedStore> {
  const res = await fetch(`${GITHUB_API_URL}?ref=${GITHUB_BRANCH}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (res.status === 404) return { store: emptyStore(), sha: undefined };
  if (!res.ok) {
    throw new Error(`[bookingStore] GitHub read failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
  const data = (await res.json()) as { content: string; sha: string };
  const raw = Buffer.from(data.content, 'base64').toString('utf-8');
  const parsed = fillMissingDays(JSON.parse(raw) as StoreShape);
  return { store: parsed, sha: data.sha };
}

async function writeStoreToGithub(store: StoreShape, sha: string | undefined): Promise<string> {
  const res = await fetch(GITHUB_API_URL, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      message: `bookings update ${new Date().toISOString()}`,
      content: Buffer.from(JSON.stringify(store, null, 2), 'utf-8').toString('base64'),
      branch: GITHUB_BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`[bookingStore] GitHub write failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
  const data = (await res.json()) as { content: { sha: string } };
  return data.content.sha;
}

async function readStoreFromDisk(): Promise<LoadedStore> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    return { store: fillMissingDays(JSON.parse(raw) as StoreShape) };
  } catch {
    return { store: emptyStore() };
  }
}

async function writeStoreToDisk(store: StoreShape): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

// Короткий кэш — только для «просто покажи мне занятые места» (публичная
// схема зала, панель администратора). Бронирование/освобождение места
// (reserveSeats/releaseSeat) всегда читают свежие данные напрямую — им
// нельзя работать по устаревшему снимку перед записью.
const CACHE_TTL_MS = 5000;
let cache: { store: StoreShape; sha: string | undefined; fetchedAt: number } | null = null;

async function loadStoreFresh(): Promise<LoadedStore> {
  return githubEnabled() ? readStoreFromGithub() : readStoreFromDisk();
}

async function loadStoreCached(): Promise<LoadedStore> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return { store: cache.store, sha: cache.sha };
  }
  const loaded = await loadStoreFresh();
  cache = { store: loaded.store, sha: loaded.sha, fetchedAt: Date.now() };
  return loaded;
}

async function persistStore(store: StoreShape, sha: string | undefined): Promise<void> {
  if (githubEnabled()) {
    const newSha = await writeStoreToGithub(store, sha);
    cache = { store, sha: newSha, fetchedAt: Date.now() };
  } else {
    await writeStoreToDisk(store);
    cache = { store, sha: undefined, fetchedAt: Date.now() };
  }
}

// Простая последовательная очередь — не даёт двум одновременным запросам
// прочитать один и тот же файл/файл в GitHub до того, как первый допишет
// своё бронирование.
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

export async function getBookedSeats(day: string): Promise<string[]> {
  const { store } = await loadStoreCached();
  return store.bookedSeats[day] ?? [];
}

export type ReserveResult =
  | { ok: true; bookingId: string }
  | { ok: false; reason: 'taken'; takenSeatIds: string[] }
  | { ok: false; reason: 'person_limit'; alreadyBooked: number };

export function reserveSeats(params: {
  day: string;
  seatIds: string[];
  name: string;
  email: string;
  phone: string;
  // Админка занимает места без email/телефона гостя (occupy.ts) — для неё
  // лимит "не больше 4 мест на одну почту/телефон" смысла не имеет и не
  // должен применяться.
  enforcePersonLimit?: boolean;
}): Promise<ReserveResult> {
  return serialize(async () => {
    const { store, sha } = await loadStoreFresh();
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

    if (params.enforcePersonLimit) {
      const emailNorm = params.email.trim().toLowerCase();
      const phoneNorm = normalizedPhone(params.phone);
      const alreadyBooked = store.bookings
        .filter(
          (b) =>
            b.day === params.day &&
            ((emailNorm && b.email.trim().toLowerCase() === emailNorm) ||
              (phoneNorm && normalizedPhone(b.phone) === phoneNorm)),
        )
        .reduce((sum, b) => sum + b.seatIds.length, 0);

      if (alreadyBooked + params.seatIds.length > MAX_SEATS_PER_BOOKING) {
        return { ok: false, reason: 'person_limit', alreadyBooked } as const;
      }
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

    await persistStore(store, sha);
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
  const { store } = await loadStoreCached();
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
    const { store, sha } = await loadStoreFresh();
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

    await persistStore(store, sha);
    return { ok: true } as const;
  });
}
