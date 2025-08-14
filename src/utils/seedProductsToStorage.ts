// src/utils/seedProductsToStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const PRODUCTS_KEY = '@products';
const META_KEY = '@products_meta';
const PRODUCTS_VERSION = 4; // yalnızca meta versiyonu – veri silme yok

export type Category = 'Temel' | 'Standart' | 'Premium' | 'Kurumsal';

export type SeedProduct = {
  id: string;
  title: string;
  price: number;
  features: string[];
  category: Category;
  categories?: string[];
  kind?: 'urun' | 'panel';
  thumbnail?: string;   // Image URI (HTTPS önerilir)
  images?: string[];    // ekstra görseller
};

/* ---------------- helpers ---------------- */

/** Görsel URL’lerini güvenli hale getirir. */
function fixImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  let s = String(url).trim().replace(/^['"]|['"]$/g, '');
  if (s.startsWith('data:image')) return s;
  if (s.startsWith('//')) s = 'https:' + s;

  // iOS ATS: uzak http istekleri engellenir -> https'e yükselt (local ağ hariç)
  const isLocalHttp = /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.)/i.test(s);
  if (s.startsWith('http://') && !isLocalHttp) s = s.replace(/^http:\/\//i, 'https://');

  return s.replace(/\s/g, '');
}

/** NON-DESTRUCTIVE migrate: sadece meta versiyonunu günceller. */
async function migrateIfNeeded() {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    const meta = raw ? JSON.parse(raw) : null;
    if (meta?.version === PRODUCTS_VERSION) return;
    await AsyncStorage.setItem(META_KEY, JSON.stringify({ version: PRODUCTS_VERSION }));
  } catch {
    // meta okunamazsa sessizce devam
  }
}

/** Eski kayıtları sterilize et (veriyi silmeden). */
async function sanitizeStoredProducts(raw: string | null) {
  if (!raw) return;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;

    let changed = false;
    const cleaned = arr.map((x: any) => {
      const nx: any = { ...x };

      // legacy: numeric image id
      if (typeof nx.image === 'number' || (typeof nx.image === 'string' && /^\d+$/.test(nx.image))) {
        delete nx.image;
        changed = true;
      }
      // legacy: image:string -> thumbnail
      if (typeof nx.image === 'string') {
        nx.thumbnail = fixImageUrl(nx.image);
        delete nx.image;
        changed = true;
      }
      if (typeof nx.thumbnail === 'string') {
        const f = fixImageUrl(nx.thumbnail);
        if (f !== nx.thumbnail) { nx.thumbnail = f; changed = true; }
      }
      if (Array.isArray(nx.images)) {
        const mapped = nx.images.map((u: any) => fixImageUrl(String(u))).filter(Boolean);
        if (JSON.stringify(mapped) !== JSON.stringify(nx.images)) { nx.images = mapped; changed = true; }
      }
      return nx;
    });

    if (changed) await AsyncStorage.setItem(PRODUCTS_KEY, JSON.stringify(cleaned));
  } catch {
    // JSON bozuksa bile silme: kullanıcı verisi korunmalı
  }
}

/* ---------------- API ---------------- */

/**
 * Depoyu hazırlar. Varsayılan: SADECE migrasyon/temizlik yapar,
 * **demo yazmaz** ve mevcut veriyi **silmez**.
 * Test için demo istersen: seedProductsToStorage({ seedDemo: true })
 */
export async function seedProductsToStorage(opts: { seedDemo?: boolean } = {}) {
  await migrateIfNeeded();

  const existing = await AsyncStorage.getItem(PRODUCTS_KEY);
  if (existing !== null) {
    // Key zaten var -> sadece sanitize et
    await sanitizeStoredProducts(existing);
    return;
  }

  // Key yoksa: üretimde boş dizi ile başlat
  const { seedDemo = false } = opts;

  if (seedDemo) {
    const DEMOS: SeedProduct[] = [
      {
        id: 'demo-basic',
        title: 'DEMO - E-Ticaret Temel',
        price: 299,
        features: ['10 Ürün', 'Temel Tema', 'SSL Sertifikası'],
        category: 'Temel',
        kind: 'urun',
        thumbnail: fixImageUrl('https://picsum.photos/seed/nlk-basic/1200/675'),
      },
    ];
    await AsyncStorage.setItem(PRODUCTS_KEY, JSON.stringify(DEMOS));
  } else {
    await AsyncStorage.setItem(PRODUCTS_KEY, JSON.stringify([]));
  }
}

/** Tamamen temizlemek için yardımcı (@products + meta). */
export async function purgeProducts() {
  await AsyncStorage.multiRemove([PRODUCTS_KEY, META_KEY]);
}

/** Var olan listeyi verilen ürünlerle (sanitize ederek) KAYDET (tam replace). */
export async function saveProducts(list: SeedProduct[]) {
  const sanitized = (Array.isArray(list) ? list : []).map(p => ({
    ...p,
    thumbnail: fixImageUrl(p.thumbnail),
    images: Array.isArray(p.images) ? p.images.map(fixImageUrl).filter(Boolean) : undefined,
  }));
  await AsyncStorage.setItem(PRODUCTS_KEY, JSON.stringify(sanitized));
}

/** Okuması kolay bir yardımcı. */
export async function getProducts(): Promise<SeedProduct[]> {
  try {
    const raw = await AsyncStorage.getItem(PRODUCTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Android → iOS veri taşımak için dışa/içe aktarma yardımcıları. */
export async function exportProductsString(): Promise<string> {
  const list = await getProducts();
  return JSON.stringify(list, null, 2);
}

export async function importProductsString(json: string) {
  const arr = JSON.parse(json);
  if (!Array.isArray(arr)) throw new Error('Geçersiz ürün listesi');
  await saveProducts(arr); // sanitize ederek yazar
}
