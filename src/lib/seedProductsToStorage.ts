// src/lib/seedProductsToStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Uygulama ilk açılışta varsayılan (yerleşik) ürün/panel setini
 * AsyncStorage'a yazar. Eğer kullanıcı daha önce kendi ürünlerini
 * eklediyse, mevcut kayıtlar KORUNUR; eksik yerleşikler eklenir
 * ve eski şemadaki kayıtlar normalize edilir.
 */

export const PRODUCT_KEY = '@products';

/** Bu dosyada harici Product tipi KULLANMIYORUZ.
 *  Çakışmaları önlemek için kendi seed tipimizi tanımlıyoruz.
 */
type CategoryLocal = 'Temel' | 'Standart' | 'Premium' | 'Kurumsal' | 'Hizmet';
export type SeedProduct = {
  id: string;
  title: string;
  price: number;
  features: string[];
  category: CategoryLocal;

  // İsteğe bağlı zengin alanlar (UI ile uyumlu)
  categories?: string[];
  kind?: 'urun' | 'panel';
  panelUrl?: string;
  images?: string[];
  thumbnail?: string;
  isFeatured?: boolean;

  // Seed işareti ve zaman damgaları
  builtIn?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

/* ============== Varsayılan (yerleşik) kayıtlar ============== */
const BASE: SeedProduct[] = [
  {
    id: 'basic',
    title: 'E-Ticaret Temel',
    price: 299,
    features: ['10 Ürün', 'Temel Tema', 'SSL Sertifikası'],
    category: 'Temel',
    categories: ['Temel'],
    kind: 'urun',
    images: [],
    thumbnail: undefined,
    isFeatured: true,
    builtIn: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'starter',
    title: 'Başlangıç',
    price: 399,
    features: ['50 Ürün', 'Tema Seçimi', 'SSL Sertifikası'],
    category: 'Temel',
    categories: ['Temel'],
    kind: 'urun',
    images: [],
    isFeatured: false,
    builtIn: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'standard',
    title: 'E-Ticaret Standart',
    price: 599,
    features: ['Sınırsız Ürün', 'Gelişmiş Tema', 'Çoklu Kargo'],
    category: 'Standart',
    categories: ['Standart'],
    kind: 'urun',
    images: [],
    isFeatured: true,
    builtIn: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pro',
    title: 'Pro',
    price: 899,
    features: ['Sınırsız Ürün', 'Blog', 'Canlı Destek'],
    category: 'Premium',
    categories: ['Premium'],
    kind: 'urun',
    images: [],
    isFeatured: false,
    builtIn: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'premium',
    title: 'Premium',
    price: 1299,
    features: ['B2B Modülü', 'Pazaryeri Entegrasyonu', 'Raporlama'],
    category: 'Premium',
    categories: ['Premium'],
    kind: 'urun',
    images: [],
    isFeatured: true,
    builtIn: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'enterprise',
    title: 'Kurumsal',
    price: 1999,
    features: ['Kurumsal SLA', 'SAML SSO', 'Özel Geliştirme'],
    category: 'Kurumsal',
    categories: ['Kurumsal'],
    kind: 'urun',
    images: [],
    isFeatured: false,
    builtIn: true,
    createdAt: new Date().toISOString(),
  },
  // İsteğe bağlı örnek panel/hizmet
  {
    id: 'panel-silver',
    title: 'Yönetim Paneli • Silver',
    price: 1499,
    features: ['100 Ürün Limiti', '5 Premium Tema', 'SSL + CDN'],
    category: 'Hizmet', // UI normalizasyonunda 4 temel kategoriye düşürülebilir
    categories: ['Hizmet', 'Panel'],
    kind: 'panel',
    panelUrl: undefined,
    images: [],
    isFeatured: false,
    builtIn: true,
    createdAt: new Date().toISOString(),
  },
];

/* ===================== Yardımcılar ===================== */

const asStringArray = (val: any): string[] => {
  if (Array.isArray(val)) return val.filter(Boolean).map(String);
  if (typeof val === 'string')
    return val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
};

const keyOf = (x: any): string => {
  const id = String(x?.id ?? x?.slug ?? '').trim();
  if (id) return id;
  const title = String(x?.title ?? '').trim();
  return title || Math.random().toString(36).slice(2);
};

/** Eski/kısmi kayıtları SeedProduct şemasına dönüştürür. */
const normalize = (raw: any): SeedProduct => {
  const id = keyOf(raw);
  const title = String(raw?.title ?? '').trim();
  const price = Number(raw?.price ?? raw?.priceMonthly ?? 0) || 0;

  // category -> CategoryLocal, fakat UI'da sadece Temel/Standart/Premium/Kurumsal filtreleniyor.
  const category = String(raw?.category ?? raw?.cat ?? 'Temel').trim() as CategoryLocal;
  const categories = asStringArray(raw?.categories);
  const features = asStringArray(raw?.features);

  const images = asStringArray(raw?.images);
  const thumbnail =
    typeof raw?.thumbnail === 'string' && raw.thumbnail.trim() ? String(raw.thumbnail).trim() : images[0];

  const kind: 'urun' | 'panel' = raw?.kind === 'panel' ? 'panel' : 'urun';

  const createdAt = String(raw?.createdAt ?? '').trim() || new Date().toISOString();
  const updatedAt = raw?.updatedAt ? String(raw.updatedAt) : undefined;

  return {
    id,
    title,
    price,
    features,
    category,
    categories: categories.length ? categories : (category ? [category] : []),
    kind,
    panelUrl: raw?.panelUrl ? String(raw.panelUrl) : undefined,
    images,
    thumbnail,
    isFeatured: !!raw?.isFeatured,
    builtIn: !!raw?.builtIn,
    createdAt,
    updatedAt,
  };
};

/* ===================== Seed / Merge ===================== */

export async function seedProductsToStorage(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PRODUCT_KEY);
    const current = raw ? JSON.parse(raw) : [];

    // Hiç kayıt yoksa: doğrudan BASE yaz
    if (!Array.isArray(current) || current.length === 0) {
      await AsyncStorage.setItem(PRODUCT_KEY, JSON.stringify(BASE));
      return;
    }

    // Var olanları normalize edip id → record map'ine koy
    const map = new Map<string, SeedProduct>();
    for (const item of current) {
      try {
        const n = normalize(item);
        // Boş başlık/id olmasın
        if (!n.id || !n.title) continue;
        map.set(n.id, n);
      } catch {
        // bozuk kayıtları atla
      }
    }

    // BASE içindeki yerleşik kayıtları eksikse ekle (mevcutları EZME)
    for (const base of BASE) {
      if (!map.has(base.id)) {
        map.set(base.id, base);
      } else {
        // Yumuşak birleştirme: mevcut kullanıcı verisi öncelikli olsun,
        // ama boş/eksik alanlar BASE'den dolsun.
        const exist = map.get(base.id)!;
        map.set(base.id, {
          ...base,                     // yerleşik defaultlar
          ...exist,                    // kullanıcının kayıtları öncelikli
          category: (exist.category || base.category) as CategoryLocal,
          categories:
            (exist.categories && exist.categories.length ? exist.categories : base.categories) ?? [],
          features: exist.features && exist.features.length ? exist.features : base.features,
          images: exist.images ?? base.images ?? [],
          thumbnail: exist.thumbnail ?? base.thumbnail,
          builtIn: true,               // aynı id seed'de varsa builtIn işaretli kalsın
          createdAt: exist.createdAt ?? base.createdAt,
          updatedAt: exist.updatedAt ?? base.updatedAt,
        });
      }
    }

    await AsyncStorage.setItem(PRODUCT_KEY, JSON.stringify(Array.from(map.values())));
  } catch (e) {
    console.warn('seedProductsToStorage error:', e);
  }
}
