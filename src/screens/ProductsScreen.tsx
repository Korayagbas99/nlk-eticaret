// src/screens/ProductsScreen.tsx
import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, Image, StatusBar,
  RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../theme';
import type { Category } from '../types';
import { useFavorites } from '../context/favorites';
import { useUser } from '../context/user';

// ✅ doğru dosya yolları
import { seedProductsToStorage } from '../utils/seedProductsToStorage';
import { fixImageUrl } from '../utils/fixImageUrl';

type Pack = {
  id: string;
  title: string;
  price: number;
  features: string[];
  category: Category;
  categories?: string[];
  kind?: 'urun' | 'panel';
  panelUrl?: string;
  images?: string[];
  thumbnail?: string;
  isFeatured?: boolean;
  builtIn?: boolean;
  updatedAt?: string;
};

type FilterCat = 'Hepsi' | string;
const PRODUCT_KEY = '@products';

const parseArray = (val: any): string[] => {
  if (Array.isArray(val)) return val.filter(Boolean).map(String);
  if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
  return [];
};
const keyOf = (x: any) => String(x?.id ?? x?.slug ?? x?.title ?? '').trim();

export default function ProductsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const role = (user as any)?.role;
  const perms: string[] = (user as any)?.permissions ?? [];
  const isAdmin = role === 'admin';
  const canCreate = isAdmin && perms.includes('product:create');

  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<FilterCat>('Hepsi');

  const [items, setItems] = useState<Pack[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PRODUCT_KEY);
      let list: any[] = [];

      if (raw) {
        try {
          const arr = JSON.parse(raw);
          list = Array.isArray(arr) ? arr : [];
        } catch {
          list = [];
        }
      }

      // Kayıt yoksa: seed sadece anahtarı oluşturur (demo basmaz)
      if (list.length === 0) {
        await seedProductsToStorage({ seedDemo: false });
        const raw2 = await AsyncStorage.getItem(PRODUCT_KEY);
        try {
          const arr2 = raw2 ? JSON.parse(raw2) : [];
          list = Array.isArray(arr2) ? arr2 : [];
        } catch {
          list = [];
        }
      }

      const mapped: Pack[] = list
        .map((x: any): Pack | null => {
          const id = keyOf(x);
          const title = String(x?.title ?? '').trim();
          if (!id || !title) return null;

          const price = Number(x?.price ?? x?.priceMonthly ?? 0) || 0;
          const features = parseArray(x?.features);

          const catRaw = String(x?.category ?? 'Temel').trim() as Category;
          const category: Category =
            (['Temel', 'Standart', 'Premium', 'Kurumsal'] as const).includes(catRaw as any) ? catRaw : 'Temel';

          const categories = parseArray(x?.categories);

          // Görselleri güvenli hâle getir
          const imgs = (Array.isArray(x?.images) ? x.images.map(String) : [])
            .map(fixImageUrl)
            .filter(Boolean) as string[];
          const thumbRaw = (typeof x?.thumbnail === 'string' && x.thumbnail ? x.thumbnail : imgs[0]);
          const thumbnail = fixImageUrl(thumbRaw);

          const kind: 'urun' | 'panel' = x?.kind === 'panel' ? 'panel' : 'urun';
          const panelUrl: string | undefined =
            kind === 'panel' && typeof x?.panelUrl === 'string' && x.panelUrl ? x.panelUrl : undefined;

          return {
            id, title, price, features, category, categories, kind, panelUrl,
            images: imgs, thumbnail, isFeatured: !!x?.isFeatured, builtIn: !!x?.builtIn, updatedAt: x?.updatedAt,
          };
        })
        .filter(Boolean) as Pack[];

      setItems(mapped);
    } catch (e) {
      console.warn('loadAll products error:', e);
      setItems([]);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  React.useEffect(() => {
    const unsub = navigation.addListener('focus', loadAll);
    loadAll();
    return unsub;
  }, [navigation, loadAll]);

  const { isFavorite, toggleFavorite } = useFavorites();
  const toFav = (p: Pack) => ({
    id: p.id, title: p.title, priceMonthly: p.price, addedDate: new Date().toLocaleDateString('tr-TR'),
  });

  const categoryPills: FilterCat[] = useMemo(() => {
    const primary: string[] = ['Temel', 'Standart', 'Premium', 'Kurumsal'];
    const extras = new Set<string>();
    for (const p of items) for (const c of p.categories ?? []) if (c && !primary.includes(c)) extras.add(c);
    return ['Hepsi', ...primary, ...Array.from(extras)];
  }, [items]);

  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    const base = cat === 'Hepsi'
      ? items
      : items.filter(p => p.category === cat || (p.categories ?? []).includes(cat));
    if (!q) return base;
    return base.filter(p =>
      [p.title, ...p.features, ...(p.categories ?? [])]
        .join(' ')
        .toLocaleLowerCase('tr-TR')
        .includes(q)
    );
  }, [query, cat, items]);

  const goDetail = (id: string) => navigation.navigate('PackageDetail', { id });
  const onEdit = (id: string) => navigation.navigate('ProductAdd', { id });

  const onDelete = async (id: string) => {
    Alert.alert('Sil', 'Bu ürünü silmek istiyor musunuz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            const raw = await AsyncStorage.getItem(PRODUCT_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            const next = (Array.isArray(arr) ? arr : []).filter((x: any) => keyOf(x) !== id);
            await AsyncStorage.setItem(PRODUCT_KEY, JSON.stringify(next));
            await loadAll();
          } catch {
            Alert.alert('Hata', 'Silinirken bir sorun oluştu.');
          }
        },
      },
    ]);
  };

  // Kapak resmi bileşeni
  const CardCover = ({ uri }: { uri?: string }) => {
    const [ok, setOk] = useState(!!uri);
    return (
      <View style={styles.imgWrap}>
        {ok && uri ? (
          <Image
            source={{ uri }}
            style={styles.img}
            resizeMode="cover"
            onError={() => setOk(false)}
          />
        ) : (
          <View style={[styles.imgWrap, styles.imgPlaceholder]}>
            <Ionicons name="image-outline" size={26} color={COLORS.muted} />
          </View>
        )}
      </View>
    );
  };

  const renderCard = (p: Pack) => {
    const fav = isFavorite(p.id);
    const isPanel = p.kind === 'panel';

    return (
      <Pressable key={p.id} style={styles.card} onPress={() => goDetail(p.id)} android_ripple={{ color: '#eef0f3' }}>
        <CardCover uri={p.thumbnail || p.images?.[0]} />

        <View style={styles.rowTitle}>
          <View style={[styles.kindPill, { backgroundColor: isPanel ? '#0ea5e9' : '#111827' }]}>
            <Ionicons name={isPanel ? 'globe-outline' : 'cube-outline'} size={12} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.kindText}>{isPanel ? 'Panel' : 'Ürün'}</Text>
          </View>

          <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">{p.title}</Text>
          <View style={{ flex: 1 }} />

          <Pressable
            onPress={() => toggleFavorite(toFav(p))}
            style={styles.iconBtn}
            android_ripple={{ color: '#e6e8ee', borderless: true }}
            accessibilityLabel={fav ? 'Favoriden çıkar' : 'Favorilere ekle'}
          >
            <Ionicons name={fav ? 'heart' : 'heart-outline'} size={20} color={fav ? '#ED1C24' : COLORS.muted} />
          </Pressable>

          {isAdmin && (
            <>
              <Pressable onPress={() => onEdit(p.id)} style={styles.iconBtn} android_ripple={{ color: '#e6e8ee', borderless: true }}>
                <Ionicons name="create-outline" size={18} color={COLORS.muted} />
              </Pressable>
              <Pressable onPress={() => onDelete(p.id)} style={styles.iconBtn} android_ripple={{ color: '#e6e8ee', borderless: true }}>
                <Ionicons name="trash-outline" size={18} color="#B91C1C" />
              </Pressable>
            </>
          )}

          <Pressable style={styles.detailBtn} onPress={() => goDetail(p.id)}>
            <Text style={styles.detailText}>Detay</Text>
          </Pressable>
        </View>

        <Text style={styles.price}>
          ₺{Number(p.price).toLocaleString('tr-TR')} <Text style={styles.priceUnit}>/ay</Text>
        </Text>

        <View style={styles.featuresRow}>
          {p.features.map(f => (
            <View key={f} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>{f}</Text>
            </View>
          ))}
        </View>

        {!!p.categories?.length && (
          <View style={styles.catsRow}>
            {p.categories.slice(0, 4).map(c => (
              <View key={c} style={styles.catTiny}>
                <Text style={styles.catTinyText}>{c}</Text>
              </View>
            ))}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Başlık + arama */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Image source={require('../../assets/nlk.png')} style={{ width: 92, height: 28, resizeMode: 'contain' }} />
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={COLORS.muted} />
          <TextInput
            placeholder="Ürün / Panel Ara"
            placeholderTextColor={COLORS.muted}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 12, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Kategoriler */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10 }}
          style={{ marginTop: 4 }}
        >
          {categoryPills.map(c => {
            const active = cat === c;
            return (
              <Pressable key={c} style={[styles.pill, active && styles.pillActive]} android_ripple={{ color: '#e6e8ee' }} onPress={() => setCat(c)}>
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Liste */}
        <View style={{ marginTop: 12 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Tüm Ürünler / Paneller</Text>
            <Text style={styles.resultCount}>{list.length} sonuç</Text>
          </View>

          {list.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="pricetags-outline" size={28} color={COLORS.muted} />
              <Text style={styles.emptyText}>Henüz kayıt yok.</Text>

              {canCreate && (
                <Pressable style={styles.emptyBtn} onPress={() => navigation.navigate('ProductAdd')}>
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.emptyBtnText}>Yeni Ekle</Text>
                </Pressable>
              )}
            </View>
          )}

          {list.map(renderCard)}
        </View>
      </ScrollView>

      {canCreate && (
        <Pressable style={[styles.fab, { bottom: 24 + insets.bottom }]} onPress={() => navigation.navigate('ProductAdd')}>
          <Ionicons name="add" size={26} color="#fff" />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const CARD_RADIUS = 16;
const IMG_RADIUS = 12;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchWrap: {
    flex: 1,
    height: 40,
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

  pill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { color: COLORS.text, fontWeight: '700', fontSize: 13 },
  pillTextActive: { color: '#fff' },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  resultCount: { fontSize: 12, color: COLORS.muted },

  card: {
    marginTop: 10,
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

  rowTitle: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },

  kindPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  kindText: { color: '#fff', fontWeight: '800', fontSize: 11 },

  title: { flexShrink: 1, fontSize: 16, fontWeight: '800', color: COLORS.text, marginLeft: 8 },

  price: { fontSize: 22, fontWeight: '900', color: COLORS.text, marginTop: 2 },
  priceUnit: { fontSize: 12, fontWeight: '700', color: COLORS.muted },

  featuresRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#F3F4F6' },
  chipText: { fontSize: 12, color: COLORS.text },

  catsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  catTiny: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#e0e7ff' },
  catTinyText: { color: '#1e293b', fontSize: 11, fontWeight: '700' },

  detailBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  detailText: { fontSize: 12, color: COLORS.text, fontWeight: '700' },

  iconBtn: {
    padding: 6,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { color: COLORS.muted, fontSize: 13 },
  emptyBtn: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
