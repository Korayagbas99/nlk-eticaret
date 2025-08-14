// src/screens/PackageDetailScreen.tsx
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, Image, Pressable, FlatList, StyleSheet,
  Dimensions, Share, Alert, Platform, ToastAndroid, ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ImageView from 'react-native-image-viewing';
import { RootStackParamList } from '../types';
import { COLORS } from '../theme';
import { useCart } from '../components/sepeteekle';

// ⭐️ EKLENDİ: kullanıcı & puanlama yardımcıları
import { useUser } from '../context/user';
import StarRating from '../components/StarRating';
import { getAverage, getUserRating, rateProduct } from '../utils/ratings';

type Props = NativeStackScreenProps<RootStackParamList, 'PackageDetail'>;

type Detail = {
  id: string;
  title: string;
  price: number;
  tier: 'Basic' | 'Silver' | 'Gold' | 'Pro' | 'Enterprise';
  desc: string;
  images: string[];
  features: string[];
};

type StoredProduct = {
  id: string;
  title?: string;
  name?: string;
  price?: number | string;
  description?: string;
  desc?: string;
  image?: string;
  images?: string[];
  features?: string[];
  category?: string;
  tier?: Detail['tier'];
};

const { width } = Dimensions.get('window');
const IMG_H = Math.min(260, Math.round(width * 0.56));

// (Sadece geriye uyumluluk için) Eski statik kayıtlar – bulunmazsa fallback
const STATIC_DETAILS: Record<string, Omit<Detail, 'images' | 'features'> & { images?: string[]; features?: string[] }> = {
  basic:   { id: 'basic',   title: 'E-Ticaret Temel',    price: 299,  tier: 'Basic',      desc: 'Hızlı kurulumlu temel e-ticaret çözümü.' },
  starter: { id: 'starter', title: 'Başlangıç',          price: 399,  tier: 'Basic',      desc: '50 ürün desteği ve tema seçimi.' },
  standard:{ id: 'standard',title: 'E-Ticaret Standart', price: 599,  tier: 'Silver',     desc: 'Orta ölçek için kapsamlı çözüm.' },
  pro:     { id: 'pro',     title: 'Pro',                price: 899,  tier: 'Pro',        desc: 'Profesyonel mağaza deneyimi.' },
  premium: { id: 'premium', title: 'Premium',            price: 1299, tier: 'Gold',       desc: 'Gelişmiş entegrasyonlar.' },
  enterprise:{id:'enterprise',title:'Kurumsal',          price:1999,  tier:'Enterprise',  desc: 'Kurumsal SLA ve SSO.'},
};

function toDetail(p: StoredProduct): Detail {
  const title = (p.title ?? p.name ?? 'Ürün').toString();
  const price = Number(p.price ?? 0) || 0;
  const desc = (p.description ?? p.desc ?? '').toString();
  const tier: Detail['tier'] =
    p.tier ??
    (p.category === 'Temel' ? 'Basic'
      : p.category === 'Standart' ? 'Silver'
      : p.category === 'Premium' ? 'Gold'
      : p.category === 'Kurumsal' ? 'Enterprise'
      : 'Pro');

  const images: string[] = Array.isArray(p.images)
    ? p.images.filter(Boolean).map(String)
    : p.image ? [String(p.image)] : [];

  const features: string[] = Array.isArray(p.features) ? p.features : [];

  return { id: p.id, title, price, tier, desc, images, features };
}

const PRODUCT_KEY = '@products';

const parseArray = (val: any): string[] => {
  if (Array.isArray(val)) return val.filter(Boolean).map(String);
  if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
  return [];
};

export default function PackageDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const { add } = useCart();
  const sliderRef = useRef<FlatList<string>>(null);

  // ⭐️ kullanıcı kimliği (oy için gerekli)
  const { user } = useUser();
  const userId = useMemo<string | null>(() => {
    const u = user as any;
    return (u?.id || u?.email || u?.uid || u?.userId || null) as string | null;
  }, [user]);

  const [pack, setPack] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔍 tam ekran görüntüleyici
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // ⭐️ puan durumları
  const [avg, setAvg] = useState(0);
  const [count, setCount] = useState(0);
  const [myStars, setMyStars] = useState(0);

  const loadPack = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await AsyncStorage.getItem(PRODUCT_KEY);
      const arr: StoredProduct[] = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(arr) ? arr : [];
      const hit = list.find((p) => String(p?.id ?? '') === id);
      if (hit) {
        setPack(toDetail(hit));
      } else if (STATIC_DETAILS[id]) {
        const s = STATIC_DETAILS[id];
        setPack({
          id: s.id,
          title: s.title,
          price: s.price,
          tier: s.tier,
          desc: s.desc || '',
          images: parseArray((s as any).images),
          features: parseArray((s as any).features),
        });
      } else {
        setPack(null);
      }
    } catch (e) {
      console.warn('PackageDetail load error:', e);
      setPack(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadRatings = useCallback(async () => {
    if (!id) return;
    const { avg, count } = await getAverage(id);
    setAvg(avg);
    setCount(count);
    if (userId) {
      const mine = await getUserRating(userId, id);
      setMyStars(mine || 0);
    } else {
      setMyStars(0);
    }
  }, [id, userId]);

  useEffect(() => { loadPack(); }, [loadPack]);
  useEffect(() => { loadRatings(); }, [loadRatings]);

  const toast = (msg: string) =>
    Platform.OS === 'android' ? ToastAndroid.show(msg, ToastAndroid.SHORT) : Alert.alert('', msg);

  const handleShare = async () => {
    if (!pack) return;
    try { await Share.share({ message: `${pack.title} - ${pack.desc}` }); } catch {}
  };

  const addToCart = () => {
    if (!pack) return;
    add({ id: pack.id, name: pack.title, price: pack.price }, 1);
    toast('Sepete eklendi');
  };

  const buyNow = () => {
    if (!pack) return;
    add({ id: pack.id, name: pack.title, price: pack.price }, 1);
    (navigation as any).navigate('Tabs', { screen: 'Sepetim' });
  };

  const onChangeStars = async (val: number) => {
    if (!userId) {
      Alert.alert('Giriş gerekli', 'Puan verebilmek için önce giriş yapmalısın.');
      return;
    }
    const next = val === myStars ? 0 : val; // aynı yıldıza basınca kaldır
    await rateProduct(userId, id, next || null);
    setMyStars(next);

    const { avg, count } = await getAverage(id);
    setAvg(avg);
    setCount(count);
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!pack) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <Text style={{ color: COLORS.text, marginBottom: 12 }}>Ürün bulunamadı.</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Geri Dön</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const coverList = Array.isArray(pack.images) ? pack.images : [];
  const priceText = `₺${Number(pack.price).toLocaleString('tr-TR')}`;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </Pressable>

        <View style={styles.searchDummy}>
          <Text style={styles.searchText}>Ara...</Text>
        </View>

        <Pressable
          style={styles.iconBtn}
          onPress={() => (navigation as any).navigate('Tabs', { screen: 'Sepetim' })}
          hitSlop={10}
        >
          <Ionicons name="bag-outline" size={20} color={COLORS.text} />
        </Pressable>

        <Pressable style={styles.iconBtn} onPress={handleShare} hitSlop={10}>
          <Ionicons name="share-social-outline" size={20} color={COLORS.text} />
        </Pressable>
      </View>

      {/* CONTENT */}
      <View style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 + insets.bottom }}>
          <FlatList
            ref={sliderRef}
            data={coverList}
            keyExtractor={(uri, i) => String(uri) + i}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <Pressable onPress={() => { setViewerIndex(index); setViewerOpen(true); }}>
                <Image source={{ uri: String(item) }} style={styles.heroImg} resizeMode="cover" />
              </Pressable>
            )}
            ListEmptyComponent={<View style={{ height: IMG_H, backgroundColor: '#f2f3f5' }} />}
          />

          <View style={[styles.badge, { backgroundColor: COLORS.primary }]}>
            <Text style={styles.badgeText}>{pack.tier}</Text>
          </View>

          <View style={styles.titleWrap}>
            <Text style={styles.title}>{pack.title}</Text>

            {/* ⭐️ Ortalama ve benim puanım */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <StarRating value={avg} showCount={count} />
              <Text style={styles.myRateLabel}>• Senin puanın:</Text>
              <StarRating value={myStars} onChange={onChangeStars} />
            </View>
          </View>

          {!!pack.desc && <Text style={styles.desc}>{pack.desc}</Text>}

          {!!pack.features?.length && (
            <>
              <Text style={styles.sectionTitle}>Özellikler</Text>
              <View style={styles.featuresWrap}>
                {pack.features.map((f, i) => (
                  <View style={styles.featureRow} key={i}>
                    <Ionicons name="checkmark-done" size={16} color={COLORS.primary} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>

        {/* alt yüzen bar */}
        <View
          style={[
            styles.footerFloat,
            { paddingBottom: Math.max(insets.bottom, 12), bottom: 8 + Math.max(insets.bottom, 8) },
          ]}
        >
          <Text style={styles.price}>
            {priceText}
            <Text style={styles.priceUnit}> /ay</Text>
          </Text>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable style={[styles.ctaBtn, styles.ctaGhost]} onPress={addToCart}>
              <Text style={[styles.ctaText, styles.ctaGhostText]}>Sepete Ekle</Text>
            </Pressable>
            <Pressable style={styles.ctaBtn} onPress={buyNow}>
              <Text style={styles.ctaText}>Şimdi Al</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* 🔍 tam ekran görüntüleyici */}
      <ImageView
        images={coverList.map((u) => ({ uri: u }))}
        imageIndex={viewerIndex}
        visible={viewerOpen}
        onRequestClose={() => setViewerOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  searchDummy: { flex: 1, height: 38, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', justifyContent: 'center', paddingHorizontal: 12 },
  searchText: { color: '#9aa0a6' },

  heroImg: { width, height: IMG_H, backgroundColor: '#f2f3f5' },
  badge: { position: 'absolute', top: IMG_H - 22, left: 16, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  badgeText: { color: '#fff', fontWeight: '700' },

  titleWrap: { paddingHorizontal: 16, paddingTop: 18 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text },

  myRateLabel: { marginHorizontal: 8, color: '#6b7280', fontSize: 12 },

  desc: { paddingHorizontal: 16, marginTop: 12, color: '#3f3f46', lineHeight: 20 },

  sectionTitle: { paddingHorizontal: 16, marginTop: 18, marginBottom: 8, fontSize: 16, fontWeight: '800', color: COLORS.text },
  featuresWrap: { paddingHorizontal: 16, gap: 10 },
  featureRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  featureText: { flex: 1, color: COLORS.text },

  footerFloat: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: '#eef0f3',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  price: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  priceUnit: { fontSize: 12, color: '#6b7280', fontWeight: '700' },

  ctaBtn: { height: 44, paddingHorizontal: 18, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  ctaGhost: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.primary },
  ctaGhostText: { color: COLORS.primary },

  backBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.primary },
  backBtnText: { color: '#fff', fontWeight: '700' },
});
