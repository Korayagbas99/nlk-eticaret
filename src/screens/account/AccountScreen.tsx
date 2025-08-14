// src/screens/account/AccountScreen.tsx
import React, { useMemo, useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { COLORS } from '../../theme';
import { useUser } from '../../context/user';
import { loadUserData } from '../../utils/userStorage';
import { getProducts, saveProducts, purgeProducts } from '../../utils/seedProductsToStorage'; // ✅ exportProducts → getProducts

/* ---------- helpers ---------- */
const initials = (name?: string, surname?: string) =>
  [name ?? '', surname ?? '']
    .join(' ')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0]!.toLocaleUpperCase('tr-TR'))
    .slice(0, 2)
    .join('');

// 05XXXXXXXXX -> 0XXX XXX XX XX
const formatPhone = (raw?: string) => {
  if (!raw) return '-';
  const d = String(raw).replace(/\D+/g, '');
  if (d.length !== 11) return raw;
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
};

// Yalnızca YYYY-MM-DD döndür
const onlyYMD = (s?: string) => {
  if (!s || s === '-') return '-';
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    }
  } catch {}
  return s.replace(/[T\s].*$/, '');
};

/* ---------- types (istatistik hesaplamak için) ---------- */
type ShopOrder = {
  id: string;
  date: string;
  items: { id: string; name: string; price?: number; qty: number }[];
  total: number;
  status: 'paid';
};

type PanelOrder = {
  id: string;
  date: string;
  status: 'hazirlaniyor' | 'teslim' | 'iptal';
  items: { plan: string; tier: 'Starter' | 'Silver' | 'Gold'; term: string; qty: number; price: number }[];
  activeUntil?: string;
};

/* ---------- storage keys ---------- */
const SHOP_ORDERS_KEY = 'orders';
const SERVICE_ORDERS_KEY = 'service_orders';

export default function AccountScreen({ navigation }: any) {
  const { user, hydrateFromStorage } = useUser();

  // UserProfile’da id olmayabilir -> güvenli userId
  const userId = useMemo<string | null>(() => {
    const u = user as any;
    return (u?.id || u?.email || u?.uid || u?.userId || null) as string | null;
  }, [user]);

  // ekrana dönüşte: profil & istatistikleri güncelle
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ orders: 0, packages: 0, spend: 0 });

  const fullName = useMemo(
    () => `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name || '',
    [user.firstName, user.lastName, user.name]
  );
  const memberSinceRaw = user.memberSince ?? user.createdAt ?? '-';
  const memberSince = useMemo(() => onlyYMD(memberSinceRaw), [memberSinceRaw]);

  // Admin/izin kontrolü
  const role = (user as any)?.role;
  const perms: string[] = (user as any)?.permissions ?? [];
  const isAdmin = role === 'admin';
  const canProductAdd = isAdmin && perms.includes('product:create');
  const canPanelAdd = isAdmin && perms.includes('panel:create');

  // Admin verme UI state
  const [adminEmail, setAdminEmail] = useState('');

  /* ---------- stats hesaplama ---------- */
  const parseTurkishDate = (txt: string) => {
    const tr2en = txt
      .replace('Ocak', 'January')
      .replace('Şubat', 'February')
      .replace('Mart', 'March')
      .replace('Nisan', 'April')
      .replace('Mayıs', 'May')
      .replace('Haziran', 'June')
      .replace('Temmuz', 'July')
      .replace('Ağustos', 'August')
      .replace('Eylül', 'September')
      .replace('Ekim', 'October')
      .replace('Kasım', 'November')
      .replace('Aralık', 'December');
    const d = new Date(tr2en);
    return isNaN(d.getTime()) ? null : d;
  };

  const countActivePackages = (serviceOrders: PanelOrder[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return serviceOrders.filter((o) => {
      if (o.status !== 'teslim') return false;
      if (!o.activeUntil) return true;
      const parsed = parseTurkishDate(o.activeUntil) ?? new Date(o.activeUntil);
      return parsed.getTime() >= today.getTime();
    }).length;
  };

  const loadStats = useCallback(async () => {
    if (!userId) {
      setStats({ orders: 0, packages: 0, spend: 0 });
      return;
    }
    const [shop, service] = await Promise.all([
      loadUserData<ShopOrder[]>(userId, SHOP_ORDERS_KEY),
      loadUserData<PanelOrder[]>(userId, SERVICE_ORDERS_KEY),
    ]);

    const shopOrders = Array.isArray(shop) ? shop : [];
    const serviceOrders = Array.isArray(service) ? service : [];

    const orders = shopOrders.length + serviceOrders.length;
    const spendShop = shopOrders.reduce((s, o) => s + (o.total || 0), 0);
    const spendService = serviceOrders.reduce(
      (s, o) => s + o.items.reduce((t, it) => t + it.price * it.qty, 0),
      0
    );
    const spend = spendShop + spendService;
    const packages = countActivePackages(serviceOrders);

    setStats({ orders, packages, spend });
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void hydrateFromStorage();
      void loadStats();
    }, [hydrateFromStorage, loadStats])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([hydrateFromStorage(), loadStats()]);
    setRefreshing(false);
  }, [hydrateFromStorage, loadStats]);

  /* ---------- admin verme ---------- */
  const grantAdminToEmail = async () => {
    const email = adminEmail.trim().toLowerCase();
    const emailOk = /^\S+@\S+\.\S+$/.test(email);
    if (!emailOk) {
      Alert.alert('Hata', 'Geçerli bir e-posta girin.');
      return;
    }
    try {
      const raw = await AsyncStorage.getItem('@users');
      const list = raw ? JSON.parse(raw) : [];
      const idx = (Array.isArray(list) ? list : []).findIndex(
        (u: any) => String(u?.email || '').trim().toLowerCase() === email
      );
      if (idx === -1) {
        Alert.alert('Bulunamadı', 'Bu e-posta ile kayıtlı kullanıcı yok.');
        return;
      }
      const nextPerms = Array.from(
        new Set([...(list[idx].permissions ?? []), 'product:create', 'panel:create'])
      );
      list[idx] = { ...(list[idx] ?? {}), role: 'admin', permissions: nextPerms };
      await AsyncStorage.setItem('@users', JSON.stringify(list));

      if (String(user.email || '').trim().toLowerCase() === email) {
        await hydrateFromStorage();
      }

      Alert.alert('Başarılı', 'Kullanıcıya admin yetkisi verildi.');
      setAdminEmail('');
    } catch (e) {
      console.warn('grantAdminToEmail error:', e);
      Alert.alert('Hata', 'Güncelleme sırasında bir sorun oluştu.');
    }
  };

  /* ---------- ürün transferi (dışa/İçe aktar/purge) ---------- */
  const onExport = async () => {
    try {
      const list = await getProducts(); // ✅ exportProducts yerine
      const pretty = JSON.stringify(list ?? [], null, 2);
      await Clipboard.setStringAsync(pretty);
      Alert.alert('Kopyalandı', 'Ürün JSON’u panoya kopyalandı.');
    } catch {
      Alert.alert('Hata', 'Dışa aktarılırken bir sorun oluştu.');
    }
  };

  const onImportReplace = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('Array değil');
      await saveProducts(parsed);
      Alert.alert('Başarılı', 'Ürünler içe aktarıldı.');
    } catch {
      Alert.alert('Hata', 'Geçersiz JSON. Panodan geçerli bir ürün listesi yapıştır.');
    }
  };

  const onPurge = async () => {
    Alert.alert('Tümünü Sil', 'Tüm ürünler silinecek. Emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await purgeProducts();
            Alert.alert('Temizlendi', 'Ürünler silindi.');
          } catch {
            Alert.alert('Hata', 'Silme sırasında sorun oluştu.');
          }
        },
      },
    ]);
  };

  const go = (route: string) => navigation.navigate(route as never);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Hesabım</Text>
        <Pressable onPress={() => go('Security')} hitSlop={10}>
          <Ionicons name="settings-outline" size={22} color={COLORS.text} />
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Profil kartı */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.avatar}>
              {user.avatarUri ? (
                <Image source={{ uri: user.avatarUri }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text style={styles.avatarText}>{initials(user.firstName, user.lastName) || 'U'}</Text>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{fullName || 'İsimsiz Kullanıcı'}</Text>
              <Text style={styles.member}>Üyelik tarihi: {memberSince}</Text>
              {!!role && (
                <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>
                  Rol: <Text style={{ fontWeight: '700' }}>{role}</Text>
                </Text>
              )}
            </View>

            <Pressable onPress={() => go('PersonalInfo')} hitSlop={8}>
              <Ionicons name="create-outline" size={20} color={COLORS.muted} />
            </Pressable>
          </View>

          {/* İletişim & adres */}
          <View style={styles.infoList}>
            <InfoRow icon="mail-outline" text={user.email?.trim() || '-'} />
            <InfoRow icon="call-outline" text={formatPhone(user.phone)} />
            <InfoRow icon="location-outline" text={user.address?.trim() || '-'} multiline />
          </View>

          <View style={styles.divider} />

          {/* İstatistikler - dinamik */}
          <View style={styles.statsRow}>
            <Stat color={COLORS.statBlue}   value={`${stats.orders}`}  label="Toplam Sipariş" />
            <Stat color={COLORS.statGreen}  value={`${stats.packages}`} label="Aktif Paket" />
            <Stat
              color={COLORS.statViolet}
              value={`₺${Number(stats.spend || 0).toLocaleString('tr-TR')}`}
              label="Toplam Harcama"
            />
          </View>
        </View>

        {/* Menü */}
        <MenuItem title="Kişisel Bilgiler" subtitle="Profil bilgilerini düzenle" onPress={() => go('PersonalInfo')} />
        <MenuItem title="Siparişlerim"     subtitle={`${stats.orders} sipariş geçmişi`} onPress={() => go('Orders')} />
        <MenuItem title="Aktif Paketlerim" subtitle={`${stats.packages} aktif paket`} onPress={() => go('ActivePackages')} />
        <MenuItem title="Ödeme yöntemleri" subtitle="Kart ve ödeme bilgileri" onPress={() => go('PaymentMethods')} />
        <MenuItem title="Güvenlik"         subtitle="Şifre ve güvenlik ayarları" onPress={() => go('Security')} />

        {/* Yönetici bölümü */}
        {(canProductAdd || canPanelAdd) && (
          <>
            <Text style={styles.sectionHeader}>Yönetici</Text>

            <MenuItem
              title="Ürün Ekle (JSON)"
              subtitle="Cihazda ürün listesine ekle"
              onPress={() => go('ProductAdd')}
            />

            {canPanelAdd && (
              <MenuItem
                title="Panel Ekle"
                subtitle="Yönetim paneli oluştur"
                onPress={() => go('PanelAdd')}
              />
            )}

            {/* Admin: başka kullanıcıya admin verme */}
            <View style={[styles.card, { marginTop: 12 }]}>
              <Text style={{ color: COLORS.text, fontWeight: '800', marginBottom: 8 }}>Kullanıcı Yetkileri</Text>
              <Text style={{ color: COLORS.muted, fontSize: 12, marginBottom: 8 }}>
                E-posta girerek kullanıcıya <Text style={{ fontWeight: '700' }}>admin</Text> yetkisi verebilirsin.
              </Text>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={adminEmail}
                  onChangeText={setAdminEmail}
                  placeholder="kullanici@ornek.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[styles.input]}
                />
                <Pressable onPress={grantAdminToEmail} style={styles.primaryBtn} android_ripple={{ color: '#e6e8ee' }}>
                  <Text style={styles.primaryBtnText}>Admin Ver</Text>
                </Pressable>
              </View>
            </View>

            {/* Ürün Transferi: dışa aktar / içe aktar / tümünü sil */}
            <View style={[styles.card, { marginTop: 12 }]}>
              <Text style={{ color: COLORS.text, fontWeight: '800', marginBottom: 8 }}>Ürün Transferi</Text>
              <Text style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10 }}>
                JSON’u dışa aktar (panoya kopyala), içe aktar (panodan al) veya hepsini temizle.
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Pressable style={styles.secondaryBtn} onPress={onExport} android_ripple={{ color: '#e6e8ee' }}>
                  <Ionicons name="download-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.secondaryBtnText}>Dışa Aktar</Text>
                </Pressable>

                <Pressable style={styles.secondaryBtn} onPress={onImportReplace} android_ripple={{ color: '#e6e8ee' }}>
                  <Ionicons name="cloud-upload-outline" size={16} color={COLORS.primary} />{/* ✅ upload-outline → cloud-upload-outline */}
                  <Text style={styles.secondaryBtnText}>İçe Aktar (Replace)</Text>
                </Pressable>

                <Pressable style={styles.dangerBtn} onPress={onPurge} android_ripple={{ color: '#ffd6d6' }}>
                  <Ionicons name="trash-outline" size={16} color="#B91C1C" />
                  <Text style={styles.dangerBtnText}>Tümünü Sil</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, text, multiline }: { icon: any; text: string; multiline?: boolean }) {
  return (
    <View style={[styles.infoRow, multiline ? { alignItems: 'flex-start' } : null]}>
      <Ionicons name={icon} size={16} color={COLORS.muted} style={{ marginTop: multiline ? 2 : 0 }} />
      <Text style={[styles.infoText, multiline ? { flex: 1 } : null]} numberOfLines={multiline ? 3 : 1}>
        {text}
      </Text>
    </View>
  );
}

function Stat({ color, value, label }: { color: string; value: string; label: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuItem({
  title, subtitle, onPress,
}: { title: string; subtitle?: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: '#e6e8ee' }}
      style={({ pressed }) => [styles.menuCard, pressed ? { opacity: 0.96, transform: [{ scale: 0.998 }] } : null]}
      hitSlop={8}
      pressRetentionOffset={8}
      accessibilityRole="button"
      testID={`menu-${title}`}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.menuTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 52,
    backgroundColor: COLORS.bg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12, overflow: 'hidden',
  },
  avatarText: { color: 'white', fontSize: 18, fontWeight: '800' },
  name: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  member: { fontSize: 12, color: COLORS.muted, marginTop: 4 },

  infoList: { marginTop: 12, gap: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13, color: COLORS.text, flexShrink: 1 },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },

  statsRow: { flexDirection: 'row', gap: 8 },
  statItem: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 12, color: COLORS.muted, textAlign: 'center', marginTop: 2 },

  menuCard: {
    marginTop: 12,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  menuSubtitle: { fontSize: 12, color: COLORS.muted, marginTop: 2 },

  sectionHeader: {
    marginTop: 18,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.muted,
  },

  input: {
    flex: 1,
    height: 44,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 12,
    backgroundColor: '#fff', color: COLORS.text,
  },
  primaryBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800' },

  /* Ürün Transferi butonları */
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtnText: { color: COLORS.primary, fontWeight: '800', fontSize: 12 },

  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  dangerBtnText: { color: '#B91C1C', fontWeight: '800', fontSize: 12 },
});
