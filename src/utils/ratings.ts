// src/utils/ratings.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const RATINGS_KEY = '@ratings';

type UserId = string;
type ProductId = string;

/** store şekli: { [productId]: { [userId]: 1..5 } } */
export type RatingsStore = Record<ProductId, Record<UserId, number>>;

async function readStore(): Promise<RatingsStore> {
  try {
    const raw = await AsyncStorage.getItem(RATINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    return {};
  }
}

async function writeStore(store: RatingsStore) {
  await AsyncStorage.setItem(RATINGS_KEY, JSON.stringify(store));
}

export async function getUserRating(userId: UserId, productId: ProductId): Promise<number | null> {
  if (!userId || !productId) return null;
  const store = await readStore();
  const v = store[productId]?.[userId];
  return typeof v === 'number' ? v : null;
}

/** stars: 1..5 → set; null/0 → kaldır */
export async function rateProduct(userId: UserId, productId: ProductId, stars: number | null) {
  if (!userId || !productId) return;
  const store = await readStore();

  if (!store[productId]) store[productId] = {};
  if (stars && stars >= 1 && stars <= 5) {
    store[productId][userId] = Math.round(stars);
  } else {
    delete store[productId][userId];
    if (Object.keys(store[productId]).length === 0) {
      delete store[productId];
    }
  }
  await writeStore(store);
}

export async function getAverage(productId: ProductId): Promise<{ avg: number; count: number }> {
  const store = await readStore();
  const map = store[productId] ?? {};
  const vals = Object.values(map).filter((n) => typeof n === 'number');
  if (!vals.length) return { avg: 0, count: 0 };
  const sum = vals.reduce((s, n) => s + n, 0);
  return { avg: sum / vals.length, count: vals.length };
}

/** Liste için tek seferde ortalamalar */
export async function getAveragesMap(ids: ProductId[]): Promise<Record<ProductId, { avg: number; count: number }>> {
  const store = await readStore();
  const out: Record<ProductId, { avg: number; count: number }> = {};
  for (const id of ids) {
    const map = store[id] ?? {};
    const vals = Object.values(map);
    if (!vals.length) out[id] = { avg: 0, count: 0 };
    else {
      const sum = vals.reduce((s, n) => s + n, 0);
      out[id] = { avg: sum / vals.length, count: vals.length };
    }
  }
  return out;
}
