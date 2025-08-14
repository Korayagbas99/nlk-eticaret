// src/utils/wallet.ts
import { loadUserData, saveUserData } from './userStorage';

export const CARDS_KEY = 'cards';

export type CardBrand = 'Visa' | 'Mastercard' | 'Amex' | 'Troy' | 'Bilinmiyor';
export type UICard = { id: string; brand: CardBrand; holder: string; last4: string; expiry: string };
export type CardStore = { list: UICard[]; defaultId: string | null };

/** Ortak: yalnız rakam */
export const onlyDigits = (s: string) => String(s || '').replace(/\D+/g, '');

export const detectBrand = (digits: string): CardBrand => {
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^(?:9792|65|36|2205|979)/.test(digits)) return 'Troy';
  return 'Bilinmiyor';
};

/** Kullanıcı cüzdanını oku; yoksa oluştur */
export async function loadWallet(userId: string): Promise<CardStore> {
  const store = await loadUserData<CardStore>(userId, CARDS_KEY);
  if (store && Array.isArray(store.list)) return { list: store.list, defaultId: store.defaultId ?? null };
  const empty: CardStore = { list: [], defaultId: null };
  await saveUserData(userId, CARDS_KEY, empty);
  return empty;
}

/** Cüzdana kart ekle (aynı last4/holder varsa yinelenmesin) */
export async function addCardToWallet(userId: string, card: UICard) {
  const store = await loadWallet(userId);
  const dedup = store.list.filter(c => !(c.last4 === card.last4 && c.holder.trim() === card.holder.trim()));
  const nextList = [card, ...dedup];
  const nextDefault = store.defaultId ?? card.id;
  await saveUserData(userId, CARDS_KEY, { list: nextList, defaultId: nextDefault });
}

/** Varsayılan kartı değiştir / kart sil yardımcıları (isteğe bağlı) */
export async function setDefaultCard(userId: string, id: string | null) {
  const store = await loadWallet(userId);
  await saveUserData(userId, CARDS_KEY, { ...store, defaultId: id });
}
export async function removeCard(userId: string, id: string) {
  const store = await loadWallet(userId);
  const next = store.list.filter(c => c.id !== id);
  const nextDefault = store.defaultId === id ? (next[0]?.id ?? null) : store.defaultId;
  await saveUserData(userId, CARDS_KEY, { list: next, defaultId: nextDefault });
}

/** user objesinden tutarlı userId üret (iOS/Android aynı mantık) */
export function getUserId(u?: any): string | null {
  return (u?.id || u?.email || u?.uid || u?.userId || null) as string | null;
}
    