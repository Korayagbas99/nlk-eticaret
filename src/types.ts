// src/types.ts
import type { NavigatorScreenParams } from '@react-navigation/native';

/* ================== Alan Tipleri ================== */

/** Kategori: eski sabit seti koruyoruz; fakat ürün kayıtlarında `category` serbest metin olabilir. */
export type Category = 'Temel' | 'Standart' | 'Premium' | 'Kurumsal';

/** Ürün türü: normal ürün ya da panel/hizmet */
export type ProductKind = 'urun' | 'panel';

/** Uygulamanın tekil ürün/panel kaydı (JSON/AsyncStorage şeması) */
export type Product = {
  id: string;
  title: string;
  price: number;              // aylık fiyat varsayımı
  features: string[];         // "virgülle ayır" -> dizi
  /** Serbest ana kategori (UI'da dinamik filtre için) */
  category?: string;
  /** Ek kategoriler/etiketler (serbest) */
  categories?: string[];
  /** 'urun' | 'panel' */
  kind: ProductKind;
  /** Panel türü için opsiyonel yönetim URL'i */
  panelUrl?: string;
  /** Cihaza kopyalanmış görsellerin URI listesi */
  images: string[];
  /** Kapak/thumbnail (genellikle images[0]) */
  thumbnail?: string;
  /** Ana sayfada “Öne çıkanlar” gibi bölümlerde kullanılabilir. */
  isFeatured?: boolean;

  createdAt?: string;
  updatedAt?: string;
};

/* ================== Navigasyon Tipleri ================== */

/** Hesap sekmesi içindeki stack */
export type AccountStackParamList = {
  AccountHome: undefined;
  PersonalInfo: undefined;
  Orders: undefined;
  ActivePackages: undefined;
  PaymentMethods: undefined;
  Security: undefined;
  Expenses: undefined;
};

/** Tab sayfaları (Hesabım sekmesi AccountStack taşır) */
export type TabParamList = {
  Anasayfa: undefined;
  Favoriler: undefined;
  Sepetim: undefined;
  Hesabım: NavigatorScreenParams<AccountStackParamList>;
};

/** Root (Auth + Tabs + ekstra sayfalar) — Tabs, Tab navigator'ını taşır */
export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  ResetPassword: undefined;
  Tabs: NavigatorScreenParams<TabParamList>;

  /** Ürün/panel ekle-düzenle; id verilirse düzenleme moduna geçer */
  ProductAdd: { id?: string } | undefined;

  /** Admin panel ekleme */
  PanelAdd: undefined;

  /** Paket/ürün detay (id zorunlu) */
  PackageDetail: { id: string };

  /** Destek ekranı (paket bilgisi opsiyonel taşınır) */
  Support: { packId?: string; packTitle?: string } | undefined;

  /**
   * Ürünler ekranı: dinamik kategori ve tür filtresi isteğe bağlı geçilebilir.
   * Not: `category` artık serbest string; `kind` ürün/panel filtresi sağlar.
   */
  Products: { category?: string; kind?: ProductKind } | undefined;
};
