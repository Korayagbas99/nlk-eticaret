// src/screens/admin/ProductAddScreen.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  Image,
  Switch,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute, RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../../theme';
import RequireRole from '../auth/RequireRole';
import type { Category } from '../../types';

const CATS: Category[] = ['Temel', 'Standart', 'Premium', 'Kurumsal'];
const PRODUCT_KEY = '@products';

type Kind = 'urun' | 'panel';

type ProductInput = {
  id: string;
  title: string;
  price: number;
  features: string[];
  category: Category;
  categories?: string[];
  kind?: Kind;
  panelUrl?: string;
  images?: string[];
  thumbnail?: string;
  isFeatured?: boolean;
  updatedAt?: string;
};

type Params = {
  ProductAdd?: {
    id?: string;
    title?: string;
    price?: number;
    features?: string[];
    category?: Category;
  };
};

/* ---------------- helpers ---------------- */

const slugify = (s: string) =>
  s
    .toString()
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9ğüşöçı\-]/g, '')
    .replace(/\-+/g, '-');

const parseArray = (val: any): string[] => {
  if (Array.isArray(val)) return val.filter(Boolean).map(String);
  if (typeof val === 'string')
    return val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
};

const keyOf = (x: any) => String(x?.id ?? x?.slug ?? x?.title ?? '').trim();

/** uzak http -> https (ATS), //url -> https://url, boşluk temizliği */
const normalizeUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  let s = String(url).trim().replace(/^['"]|['"]$/g, '');
  if (s.startsWith('data:image')) return s;
  if (s.startsWith('//')) s = 'https:' + s;
  const isLocalHttp = /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.)/i.test(s);
  if (s.startsWith('http://') && !isLocalHttp) s = s.replace(/^http:\/\//i, 'https://');
  return s.replace(/\s/g, '');
};

/* ---------------- screen ---------------- */

export default function ProductAddScreen({ navigation }: any) {
  const route = useRoute<RouteProp<Params, 'ProductAdd'>>();
  const routeDraft = route.params ?? {};

  const [editingId, setEditingId] = useState<string | null>(routeDraft.id ?? null);
  const [existsInJson, setExistsInJson] = useState(false);

  // temel alanlar
  const [title, setTitle] = useState(routeDraft.title ?? '');
  const [price, setPrice] = useState<string>(
    routeDraft.price != null ? String(routeDraft.price) : ''
  );
  const [featuresText, setFeaturesText] = useState(
    Array.isArray(routeDraft.features) ? routeDraft.features.join(', ') : ''
  );
  const [category, setCategory] = useState<Category>(routeDraft.category ?? 'Temel');

  // gelişmiş alanlar
  const [extraCatsText, setExtraCatsText] = useState('');
  const [kind, setKind] = useState<Kind>('urun');
  const [panelUrl, setPanelUrl] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);

  // görseller
  const [images, setImages] = useState<string[]>([]);
  const [thumbnail, setThumbnail] = useState<string | undefined>(undefined);

  const allCategories = useMemo(() => {
    const extras = parseArray(extraCatsText);
    const set = new Set<string>([category, ...extras]);
    return Array.from(set);
  }, [category, extraCatsText]);

  const loadIfEditing = useCallback(async () => {
    if (!editingId) return;
    try {
      const raw = await AsyncStorage.getItem(PRODUCT_KEY);
      const list: any[] = raw ? (Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []) : [];
      const hit = list.find((x) => keyOf(x) === editingId);
      if (hit) {
        setExistsInJson(true);
        setTitle(String(hit.title ?? ''));
        setPrice(String(hit.price ?? hit.priceMonthly ?? 0));
        setFeaturesText(parseArray(hit.features).join(', '));

        const catRaw = String(hit.category ?? 'Temel').trim() as Category;
        setCategory((CATS.includes(catRaw) ? catRaw : 'Temel') as Category);

        setKind(hit.kind === 'panel' ? 'panel' : 'urun');
        setPanelUrl(String(hit.panelUrl ?? ''));

        const cats: string[] = Array.isArray(hit.categories)
          ? hit.categories.map(String).filter(Boolean)
          : [];
        const extrasOnly = cats.filter((c) => c !== catRaw);
        setExtraCatsText(extrasOnly.join(', '));

        const imgs = Array.isArray(hit.images) ? hit.images.map(String) : [];
        setImages(imgs);
        setThumbnail(hit.thumbnail ?? imgs[0]);
        setIsFeatured(!!hit.isFeatured);
      } else {
        setExistsInJson(false);
      }
    } catch (e) {
      console.warn('loadIfEditing error:', e);
    }
  }, [editingId]);

  useEffect(() => {
    loadIfEditing();
  }, [loadIfEditing]);

  // === Görsel ekle ===
  const pickImage = async () => {
    try {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsMultipleSelection: false,
      });
      if (!res.canceled && res.assets?.length) {
        const uri = res.assets[0].uri;
        setImages((prev) => {
          const next = [...prev, uri];
          if (!thumbnail) setThumbnail(uri);
          return next;
        });
      }
    } catch {
      Alert.alert('Hata', 'Görsel seçilemedi.');
    }
  };

  const removeImage = (uri: string) => {
    setImages((prev) => {
      const next = prev.filter((u) => u !== uri);
      if (thumbnail === uri) setThumbnail(next[0]);
      return next;
    });
  };

  const onSubmit = async () => {
    const t = title.trim();
    if (!t) return Alert.alert('Zorunlu', 'Başlık giriniz.');
    if (!price.trim() || isNaN(Number(price)))
      return Alert.alert('Zorunlu', 'Geçerli bir fiyat giriniz.');

    try {
      const raw = await AsyncStorage.getItem(PRODUCT_KEY);
      let list: any[] = raw ? (Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []) : [];

      // id belirle: düzenlemede mevcut id, değilse benzersiz slug
      let id = (editingId ?? slugify(t)) || Math.random().toString(36).slice(2);
      if (!editingId) {
        const base = id;
        let suffix = 2;
        while (list.some((x) => keyOf(x) === id)) {
          id = `${base}-${suffix++}`;
        }
      }

      // elle yazılan URL'leri normalize et (picker URI'larına dokunma)
      const normThumb =
        thumbnail && !thumbnail.startsWith('file:') && !thumbnail.startsWith('content:')
          ? normalizeUrl(thumbnail)
          : thumbnail;

      const normImages = images.map((u) =>
        u && !u.startsWith('file:') && !u.startsWith('content:') ? normalizeUrl(u)! : u
      );

      const input: ProductInput = {
        id,
        title: t,
        price: Number(price),
        features: parseArray(featuresText),
        category: (CATS.includes(category) ? category : 'Temel') as Category,
        categories: allCategories,
        kind,
        panelUrl: kind === 'panel' ? normalizeUrl(panelUrl?.trim()) : undefined,
        images: normImages,
        thumbnail:
          normImages.length ? (normThumb && normImages.includes(normThumb) ? normThumb : normImages[0]) : undefined,
        isFeatured,
        updatedAt: new Date().toISOString(),
      };

      const idx = list.findIndex((x) => keyOf(x) === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...input };
      } else {
        list.push(input);
      }

      await AsyncStorage.setItem(PRODUCT_KEY, JSON.stringify(list));

      Alert.alert('Başarılı', editingId ? 'Ürün güncellendi.' : 'Ürün eklendi.', [
        { text: 'Tamam' },
        { text: 'Ürünlere Git', onPress: () => navigation?.navigate?.('Products') },
      ]);

      if (!editingId) {
        setTitle('');
        setPrice('');
        setFeaturesText('');
        setCategory('Temel');
        setExtraCatsText('');
        setKind('urun');
        setPanelUrl('');
        setImages([]);
        setThumbnail(undefined);
        setIsFeatured(false);
      } else {
        setExistsInJson(true);
      }
      setEditingId(id);
    } catch (e) {
      console.warn('product save error:', e);
      Alert.alert('Hata', 'Ürün kaydedilirken bir sorun oluştu.');
    }
  };

  const onDelete = async () => {
    if (!editingId) return;
    try {
      const raw = await AsyncStorage.getItem(PRODUCT_KEY);
      const list: any[] = raw ? (Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []) : [];
      const next = list.filter((x) => keyOf(x) !== editingId);

      if (next.length === list.length) {
        return Alert.alert('Bilgi', 'Bu ürün JSON’da bulunamadı (gömülü olabilir).');
      }

      await AsyncStorage.setItem(PRODUCT_KEY, JSON.stringify(next));
      Alert.alert('Silindi', 'Ürün JSON’dan kaldırıldı.', [
        { text: 'Tamam', onPress: () => navigation?.navigate?.('Products') },
      ]);
    } catch (e) {
      console.warn('product delete error:', e);
      Alert.alert('Hata', 'Silinirken bir sorun oluştu.');
    }
  };

  const headerText = editingId ? 'Ürün / Panel Düzenle' : 'Ürün / Panel Ekle';

  return (
    <RequireRole requiredRole="admin" requiredPerm="product:create">
      <ScrollView style={styles.safe} contentContainerStyle={{ padding: 16 }}>
        {/* Üst başlık + Sil */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>{headerText}</Text>
          {editingId && existsInJson && (
            <Pressable
              onPress={() =>
                Alert.alert('Sil', 'Bu kaydı JSON’dan silmek istiyor musunuz?', [
                  { text: 'İptal', style: 'cancel' },
                  { text: 'Sil', style: 'destructive', onPress: onDelete },
                ])
              }
              style={styles.deleteBtn}
              android_ripple={{ color: '#ffd1d1' }}
            >
              <Ionicons name="trash-outline" size={16} color="#B91C1C" />
              <Text style={styles.deleteText}>Sil</Text>
            </Pressable>
          )}
        </View>

        {/* Tür seçimi */}
        <View style={[styles.group, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
          <Text style={styles.label}>Tür</Text>
          <View style={styles.segment}>
            <Pressable
              style={[styles.segmentItem, kind === 'urun' && styles.segmentActive]}
              onPress={() => setKind('urun')}
            >
              <Text style={[styles.segmentText, kind === 'urun' && styles.segmentTextActive]}>Ürün</Text>
            </Pressable>
            <Pressable
              style={[styles.segmentItem, kind === 'panel' && styles.segmentActive]}
              onPress={() => setKind('panel')}
            >
              <Text style={[styles.segmentText, kind === 'panel' && styles.segmentTextActive]}>Panel/Hizmet</Text>
            </Pressable>
          </View>
        </View>

        {/* Başlık */}
        <View style={styles.group}>
          <Text style={styles.label}>Başlık *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Örn: E-Ticaret Temel"
            placeholderTextColor={COLORS.muted}
            style={styles.input}
          />
        </View>

        {/* Fiyat */}
        <View style={styles.group}>
          <Text style={styles.label}>Fiyat (₺/ay) *</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="299"
            placeholderTextColor={COLORS.muted}
            keyboardType="numeric"
            style={styles.input}
          />
        </View>

        {/* Özellikler */}
        <View style={styles.group}>
          <Text style={styles.label}>Özellikler (virgülle ayır)</Text>
          <TextInput
            value={featuresText}
            onChangeText={setFeaturesText}
            placeholder="10 Ürün, SSL Sertifikası, Temel Tema"
            placeholderTextColor={COLORS.muted}
            style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
            multiline
          />
        </View>

        {/* Kategoriler */}
        <View style={styles.group}>
          <Text style={styles.label}>Ana Kategori</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CATS.map((c) => {
              const active = category === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.pill, active && styles.pillActive]}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { marginTop: 10 }]}>Ek Kategoriler (virgülle)</Text>
          <TextInput
            value={extraCatsText}
            onChangeText={setExtraCatsText}
            placeholder="Hizmet, Panel, Kampanya…"
            placeholderTextColor={COLORS.muted}
            style={styles.input}
          />

          <Text style={styles.helper}>
            Kaydedildiğinde kategoriler: {allCategories.join(' • ') || '-'}
          </Text>
        </View>

        {/* Panel URL (sadece panel) */}
        {kind === 'panel' && (
          <View style={styles.group}>
            <Text style={styles.label}>Panel URL (opsiyonel)</Text>
            <TextInput
              value={panelUrl}
              onChangeText={setPanelUrl}
              placeholder="https://panel.ornek.com/magaza-adı"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="none"
              style={styles.input}
            />
          </View>
        )}

        {/* Öne çıkarma */}
        <View style={[styles.group, styles.rowBetween]}>
          <Text style={styles.label}>Ana sayfada öne çıkar</Text>
          <Switch
            value={isFeatured}
            onValueChange={setIsFeatured}
            trackColor={{ false: '#d1d5db', true: COLORS.primary }}
            thumbColor="#fff"
            ios_backgroundColor="#d1d5db"
          />
        </View>

        {/* Görseller */}
        <View style={styles.group}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Görseller</Text>
            <Pressable style={styles.lightBtn} onPress={pickImage} android_ripple={{ color: '#e6e8ee' }}>
              <Ionicons name="image-outline" size={16} color={COLORS.primary} />
              <Text style={styles.lightBtnText}>Resim Ekle</Text>
            </Pressable>
          </View>

          {images.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingTop: 8 }}
            >
              {images.map((uri) => {
                const isCover = thumbnail === uri;
                return (
                  <View key={uri} style={styles.thumbCard}>
                    <Image source={{ uri }} style={styles.thumbImg} />
                    <View style={styles.thumbActions}>
                      {!isCover ? (
                        <Pressable
                          style={styles.thumbBtn}
                          onPress={() => setThumbnail(uri)}
                          android_ripple={{ color: '#e6e8ee' }}
                        >
                          <Ionicons name="star-outline" size={14} color={COLORS.primary} />
                          <Text style={styles.thumbBtnText}>Kapak</Text>
                        </Pressable>
                      ) : (
                        <View style={[styles.coverPill]}>
                          <Ionicons name="star" size={14} color="#fff" />
                          <Text style={styles.coverPillText}>Kapak</Text>
                        </View>
                      )}
                      <Pressable
                        style={[styles.thumbBtn, { backgroundColor: '#fff1f1', borderColor: '#fecaca' }]}
                        onPress={() => removeImage(uri)}
                        android_ripple={{ color: '#ffdede' }}
                      >
                        <Ionicons name="trash-outline" size={14} color="#B91C1C" />
                        <Text style={[styles.thumbBtnText, { color: '#B91C1C' }]}>Sil</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.helper}>Görsel eklemediğinizde ürün listeleri yine çalışır; kapak görseli önerilir.</Text>
          )}
        </View>

        {/* Kaydet */}
        <Pressable style={styles.saveBtn} onPress={onSubmit} android_ripple={{ color: '#e6e8ee' }}>
          <Ionicons name="save-outline" size={16} color="#fff" />
          <Text style={styles.saveText}>{editingId ? 'Güncelle' : 'Kaydet'}</Text>
        </Pressable>

        {editingId && !existsInJson && (
          <Text style={styles.infoNote}>
            Bu kayıt sistemde gömülü olabilir. Kaydedince aynı id ile JSON’da özel bir kayıt
            oluşur ve listede bu kayıt öncelikli gösterilir.
          </Text>
        )}
      </ScrollView>
    </RequireRole>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 12 },

  group: { marginBottom: 12 },
  label: { color: COLORS.muted, fontSize: 12, marginBottom: 6 },
  helper: { color: COLORS.muted, fontSize: 12, marginTop: 6 },

  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
  },

  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
  },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { color: COLORS.text, fontWeight: '700', fontSize: 12 },
  pillTextActive: { color: '#fff' },

  segment: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  segmentItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  segmentActive: {
    backgroundColor: '#fff',
    borderColor: COLORS.primary,
  },
  segmentText: { color: COLORS.text, fontWeight: '700', fontSize: 12 },
  segmentTextActive: { color: COLORS.primary },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  // Görseller
  lightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  lightBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },

  thumbCard: {
    width: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  thumbImg: { width: 120, height: 90, resizeMode: 'cover' },
  thumbActions: { padding: 8, gap: 6 },
  thumbBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  thumbBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  coverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: COLORS.primary,
  },
  coverPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Kaydet / Sil
  saveBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff1f1',
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 12,
  },
  deleteText: { color: '#B91C1C', fontWeight: '700', fontSize: 12 },

  infoNote: { marginTop: 12, color: COLORS.muted, fontSize: 12 },
});
