// src/screens/HomeScreen.tsx
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, Image, Alert, Linking,
  StyleProp, TextStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ImageView from 'react-native-image-viewing';
import { COLORS } from '../theme';
import type { Category } from '../types';
import { useFavorites } from '../context/favorites';
import { IMAGES } from '../assets';

type Package = {
  id: string;
  title: string;
  price: number;
  features: string[];
  category: Category;
  demoUrl?: string;
  isFeatured?: boolean;
  thumbnail?: string;
  images?: string[];
  kind?: 'urun' | 'panel';
};

type UICategory = 'Kategoriler' | Category;

const PRODUCT_KEY = '@products';
const HIDDEN_IDS_KEY = '@products:hidden';
const CATEGORIES: UICategory[] = ['Kategoriler', 'Temel', 'Standart', 'Premium', 'Kurumsal'];

/* ------- iOS ATS uyumluluğu (http→https; local ağları hariç) ------- */
function fixUrl(url?: string): string | undefined {
  if (!url) return undefined;
  let s = String(url).trim().replace(/^['"]|['"]$/g, '');
  if (s.startsWith('data:image')) return s;
  if (s.startsWith('//')) s = 'https:' + s;
  const isLocalHttp = /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.)/i.test(s);
  if (s.startsWith('http://') && !isLocalHttp) s = s.replace(/^http:\/\//i, 'https://');
  return s.replace(/\s/g, '');
}

export default function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | 'Hepsi'>('Hepsi');
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);

  const [items, setItems] = useState<Package[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);

  // fullscreen viewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<{ uri: string }[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  // ❤️ Favoriler
  const { isFavorite, toggleFavorite } = useFavorites();
  const toFav = (p: Package) => ({
    id: p.id,
    title: p.title,
    priceMonthly: p.price,
    addedDate: new Date().toLocaleDateString('tr-TR'),
  });

  const go = (route: string, params?: any) => navigation?.navigate?.(route as never, params as never);

  const parseArray = (val: any): string[] => {
    if (Array.isArray(val)) return val.filter(Boolean).map(String);
    if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
    return [];
  };

  const loadProducts = useCallback(async () => {
    try {
      const [raw, rawHidden] = await Promise.all([
        AsyncStorage.getItem(PRODUCT_KEY),
        AsyncStorage.getItem(HIDDEN_IDS_KEY),
      ]);
      const hiddenIds = rawHidden ? JSON.parse(rawHidden) : [];
      setHidden(Array.isArray(hiddenIds) ? hiddenIds.map(String) : []);

      const arr = raw ? JSON.parse(raw) : [];
      const list: Package[] = (Array.isArray(arr) ? arr : [])
        .map((x: any): Package | null => {
          const id = String(x?.id ?? x?.slug ?? x?.title ?? '').trim() || Math.random().toString(36).slice(2);
          const title = String(x?.title ?? '').trim();
          if (!title) return null;

          const price = Number(x?.price ?? x?.priceMonthly ?? 0) || 0;
          const features = parseArray(x?.features);

          const catRaw = String(x?.category ?? 'Temel').trim() as Category;
          const category: Category =
            (['Temel', 'Standart', 'Premium', 'Kurumsal'] as const).includes(catRaw as any) ? catRaw : 'Temel';

          const imgList = parseArray(x?.images).map(fixUrl).filter(Boolean) as string[];
          const thumb = fixUrl(typeof x?.thumbnail === 'string' && x.thumbnail.trim() ? x.thumbnail : imgList[0]);
          const kind = x?.kind === 'panel' ? 'panel' : 'urun';

          return { id, title, price, features, category, isFeatured: !!x?.isFeatured, images: imgList, thumbnail: thumb, kind };
        })
        .filter(Boolean) as Package[];

      setItems(list);
    } catch (e) {
      console.warn('HomeScreen loadProducts error:', e);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    const unsub = navigation?.addListener?.('focus', loadProducts);
    loadProducts();
    return unsub;
  }, [navigation, loadProducts]);

  // Katalog (sadece storage; statik fallback YOK)
  const catalog: Package[] = useMemo(
    () => items.filter(p => !hidden.includes(p.id)),
    [items, hidden]
  );

  // Öne çıkanlar
  const featured: Package[] = useMemo(() => {
    const base = activeCategory === 'Hepsi' ? catalog : catalog.filter(p => p.category === activeCategory);
    const marked = base.filter(p => p.isFeatured);
    if (marked.length) return marked.slice(0, 3);
    // Hiç işaretli yoksa en güncel/eklenmiş gibi düşünmek için basitçe fiyata göre yakın 3 item
    return base.slice(0, 3);
  }, [catalog, activeCategory]);

  // Arama
  const searchResults = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    let base = catalog;
    if (activeCategory !== 'Hepsi') base = base.filter(p => p.category === activeCategory);
    if (!q) return base;
    return base.filter(p => [p.title, ...p.features].join(' ').toLocaleLowerCase('tr-TR').includes(q));
  }, [query, activeCategory, catalog]);

  const onTapCategory = (c: UICategory) => setActiveCategory(c === 'Kategoriler' ? 'Hepsi' : c);

  const openDemoFor = (pack: Package) => {
    setSelectedPackId(pack.id);
    if (pack.demoUrl) {
      Linking.openURL(pack.demoUrl).catch(() =>
        Alert.alert('Demo', `${pack.title} demosunu şu an açamadık.`)
      );
    } else {
      Alert.alert('Demo Talebi', `${pack.title} demosu için talebinizi aldık. Ekibimiz sizle iletişime geçecek.`);
    }
  };

  // --------- Kart Bileşeni ---------
  function PackCard({ p }: { p: Package }) {
    const fav = isFavorite(p.id);
    const [imgFailed, setImgFailed] = useState(false);
    const imgs = (p.images?.length ? p.images : p.thumbnail ? [p.thumbnail] : []).filter(Boolean) as string[];

    return (
      <Pressable
        style={styles.card}
        onPress={() => { setSelectedPackId(p.id); go('PackageDetail', { id: p.id }); }}
        android_ripple={{ color: '#eef0f3' }}
      >
        {/* Görsel */}
        {imgs.length > 0 && !imgFailed ? (
          <Pressable
            style={styles.imgWrap}
            onPress={() => { setViewerImages(imgs.map(uri => ({ uri }))); setViewerIndex(0); setViewerOpen(true); }}
          >
            <Image
              source={{ uri: imgs[0] }}
              style={styles.img}
              resizeMode="cover"
              onError={() => setImgFailed(true)}
            />
          </Pressable>
        ) : (
          <View style={[styles.imgWrap, styles.imgPlaceholder]}>
            <Ionicons name="image-outline" size={26} color={COLORS.muted} />
          </View>
        )}

        <View style={styles.rowTitle}>
          <View style={[styles.kindBadge, { backgroundColor: p.kind === 'panel' ? '#0ea5e9' : '#111827' }]}>
            <Ionicons name={p.kind === 'panel' ? 'grid-outline' : 'cube-outline'} size={12} color="#fff" />
            <Text style={styles.kindText}>{p.kind === 'panel' ? 'Panel' : 'Ürün'}</Text>
          </View>

          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">{p.title}</Text>
          <View style={{ flex: 1 }} />

          <Pressable
            onPress={() => toggleFavorite(toFav(p))}
            style={styles.iconBtn}
            android_ripple={{ color: '#e6e8ee', borderless: true }}
            accessibilityLabel={fav ? 'Favoriden çıkar' : 'Favorilere ekle'}
          >
            <Ionicons name={fav ? 'heart' : 'heart-outline'} size={20} color={fav ? '#ED1C24' : COLORS.muted} />
          </Pressable>

          <Pressable style={styles.detailBtn} onPress={() => go('PackageDetail', { id: p.id })}>
            <Text style={styles.detailBtnText}>Detay</Text>
          </Pressable>
        </View>

        <Text style={styles.price}>
          ₺{Number(p.price).toLocaleString('tr-TR')} <Text style={styles.priceUnit}>/ay</Text>
        </Text>

        <View style={styles.featuresRow}>
          {p.features.map(f => (
            <View key={f} style={styles.chip}><Text style={styles.chipText}>{f}</Text></View>
          ))}
        </View>

        <Pressable style={styles.demoBtn} onPress={() => openDemoFor(p)}>
          <Ionicons name="play-circle-outline" size={16} color="#fff" />
          <Text style={styles.demoBtnText}>Ücretsiz Demo</Text>
        </Pressable>
      </Pressable>
    );
  }
  // -----------------------------------

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Image source={IMAGES.logo} style={{ width: 92, height: 28, resizeMode: 'contain' }} />
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={COLORS.muted} />
          <TextInput
            placeholder="Paket Ara"
            placeholderTextColor={COLORS.muted}
            style={styles.searchInput}
            returnKeyType="search"
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
        {/* KATEGORİLER */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
          style={{ marginTop: 8 }}
        >
          {CATEGORIES.map((c, i) => {
            const primary = i === 0;
            const isActive = c === 'Kategoriler' ? activeCategory === 'Hepsi' : activeCategory === c;
            const pillStyle = [
              styles.pill,
              primary ? styles.pillPrimary : null,
              !primary && isActive ? styles.pillActive : null,
            ];
            const textStyle: StyleProp<TextStyle> = [
              styles.pillText,
              primary || isActive ? styles.pillTextActive : null,
            ];
            return (
              <Pressable
                key={c}
                style={pillStyle}
                android_ripple={{ color: '#e6e8ee' }}
                onPress={() => onTapCategory(c)}
              >
                {primary && <Ionicons name="menu" size={14} color="#fff" style={{ marginRight: 6 }} />}
                <Text style={textStyle}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Arama / Öne çıkanlar */}
        {query.trim() ? (
          <View style={styles.sectionPad}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Arama Sonuçları</Text>
              <Text style={styles.resultCount}>{searchResults.length} sonuç</Text>
            </View>
            {searchResults.length
              ? searchResults.map(p => <PackCard key={p.id} p={p} />)
              : <Text style={{ color: COLORS.muted }}>Sonuç bulunamadı.</Text>}
          </View>
        ) : (
          <>
            <View style={styles.sectionPad}>
              <Text style={styles.sectionTitle}>Hızlı Ulaşım</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <QuickTile
                  icon="play-circle-outline"
                  title="Demo" subtitle="Talep Et" sub2="Ücretsiz demo"
                  onPress={() => {
                    const p = catalog[0]; if (!p) return Alert.alert('Demo', 'Önce bir paket ekleyin.');
                    setSelectedPackId(p.id); openDemoFor(p);
                  }}
                />
                <QuickTile icon="headset-outline" title="Destek" sub2="7/24 yardım" onPress={() => go('Support')} />
              </View>
            </View>

            <View style={styles.sectionPad}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>Öne Çıkan Paketler</Text>
                <Pressable hitSlop={8} onPress={() => go('Products')}>
                  <Text style={styles.linkText}>Tümünü Gör</Text>
                </Pressable>
              </View>

              {catalog.length === 0 ? (
                <View style={{ paddingVertical: 16 }}>
                  <Text style={{ color: COLORS.muted }}>Henüz ürün yok. Yönetici olarak “Ürün Ekle”den ekleyebilirsin.</Text>
                </View>
              ) : featured.length === 0 ? (
                <View style={{ paddingVertical: 16 }}>
                  <Text style={{ color: COLORS.muted }}>Öne çıkarılmış ürün yok.</Text>
                </View>
              ) : (
                featured.map(p => <PackCard key={p.id} p={p} />)
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Fullscreen viewer */}
      <ImageView
        images={viewerImages}
        imageIndex={viewerIndex}
        visible={viewerOpen}
        onRequestClose={() => setViewerOpen(false)}
      />
    </SafeAreaView>
  );
}

function QuickTile({
  icon, title, subtitle, sub2, onPress,
}: { icon: any; title: string; subtitle?: string; sub2?: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.quickCard} onPress={onPress} android_ripple={{ color: '#e6e8ee' }}>
      <View style={styles.quickIconWrap}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.quickTitle}>
          {title} {subtitle ? <Text style={{ fontWeight: '700' }}> {subtitle}</Text> : null}
        </Text>
        {!!sub2 && <Text style={styles.quickSub}>{sub2}</Text>}
      </View>
    </Pressable>
  );
}

const CARD_RADIUS = 16;
const IMG_RADIUS = 12;

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchWrap: {
    flex: 1,
    height: 38,
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, color: COLORS.text, paddingVertical: 0 },

  sectionPad: { paddingHorizontal: 12, marginTop: 12 },

  pill: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { color: COLORS.text, fontWeight: '700', fontSize: 12 },
  pillTextActive: { color: '#fff', fontWeight: '800' as const },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 10 },
  resultCount: { fontSize: 12, color: COLORS.muted },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },

  card: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: CARD_RADIUS,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  imgWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: IMG_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    marginBottom: 10,
  },
  img: { width: '100%', height: '100%' },
  imgPlaceholder: { alignItems: 'center', justifyContent: 'center' },

  rowTitle: { flexDirection: 'row', alignItems: 'center', marginTop: 2, marginBottom: 6 },

  kindBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 8,
  },
  kindText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  title: { flexShrink: 1, fontSize: 15, fontWeight: '800', color: COLORS.text },

  price: { fontSize: 22, fontWeight: '900', color: COLORS.text, marginTop: 2 },
  priceUnit: { fontSize: 12, fontWeight: '700', color: '#6b7280' },

  featuresRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#F3F4F6' },
  chipText: { fontSize: 12, color: COLORS.text },

  detailBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  detailBtnText: { fontSize: 12, color: COLORS.text, fontWeight: '700' },

  iconBtn: {
    padding: 6,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  quickCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  quickIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  quickTitle: { color: COLORS.text, fontWeight: '700', fontSize: 13 },
  quickSub: { color: COLORS.muted, fontSize: 12, marginTop: 2 },

  demoBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  demoBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
