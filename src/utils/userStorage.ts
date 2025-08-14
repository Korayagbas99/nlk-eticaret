// src/utils/userStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Tek yerde prefix tutalım */
const PREFIX = 'nlk';

/** userId’i güvenli/tekilleştirilmiş hale getir (mail vs. için ideal) */
const normalizeUserId = (id: string) => id.trim().toLowerCase();

/** nlk:{userId}:{name} */
const makeKey = (userId: string, name: string) =>
  `${PREFIX}:${normalizeUserId(userId)}:${name}`;

/** JSON güvenli stringify */
const toJSON = (data: unknown) => {
  try {
    return JSON.stringify(data);
  } catch (e) {
    console.warn('[userStorage] stringify hatası:', e);
    // Yine de boş obje kaydedelim ki kırık durum kalmasın
    return JSON.stringify(null);
  }
};

/** JSON güvenli parse */
const fromJSON = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn('[userStorage] parse hatası, veri temizleniyor…', e);
    return null;
  }
};

/** Kullanıcıya özel veri kaydet */
export async function saveUserData<T = any>(
  userId: string,
  name: string,
  data: T
): Promise<void> {
  await AsyncStorage.setItem(makeKey(userId, name), toJSON(data));
}

/** Kullanıcıya özel veri yükle (yoksa null) */
export async function loadUserData<T = any>(
  userId: string,
  name: string
): Promise<T | null> {
  const raw = await AsyncStorage.getItem(makeKey(userId, name));
  const parsed = fromJSON<T>(raw);
  // Bozuk kayıt yakalandıysa otomatik temizleyelim
  if (raw && parsed === null) {
    await AsyncStorage.removeItem(makeKey(userId, name));
  }
  return parsed;
}

/** Kullanıcıya özel veri yükle; yoksa fallback döndür */
export async function loadUserDataOr<T>(
  userId: string,
  name: string,
  fallback: T
): Promise<T> {
  const val = await loadUserData<T>(userId, name);
  return val ?? fallback;
}

/** Tek bir anahtarı sil */
export async function removeUserData(
  userId: string,
  name: string
): Promise<void> {
  await AsyncStorage.removeItem(makeKey(userId, name));
}

/** Bu kullanıcıya ait TÜM anahtarları sil (logout değişiminde işine yarar) */
export async function clearUserData(userId: string): Promise<void> {
  const all = await AsyncStorage.getAllKeys();
  const prefix = `${PREFIX}:${normalizeUserId(userId)}:`;
  const mine = all.filter(k => k.startsWith(prefix));
  if (mine.length) {
    await AsyncStorage.multiRemove(mine);
  }
}

/** (İsteğe bağlı) Bu kullanıcıya ait anahtarları listele – debug için faydalı */
export async function listUserKeys(userId: string): Promise<string[]> {
  const all = await AsyncStorage.getAllKeys();
  const prefix = `${PREFIX}:${normalizeUserId(userId)}:`;
  return all.filter(k => k.startsWith(prefix));
}
