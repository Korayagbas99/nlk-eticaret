// src/screens/account/ActivePackagesScreen.tsx
import React, { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../theme';
import { useUser } from '../../context/user';

type PackageStatus = 'active' | 'expiring' | 'pending' | 'suspended';

/** Storage’ta tutulan gerçek kayıt */
type StoredActivation = {
  id: string;
  name: string;
  qty: number;
  startDate: string;       // ISO
  endDate: string;         // ISO
  status: 'active' | 'expired';
  orderId: string;
  panelUrl?: string;
  autoRenew?: boolean;
};

type UiPackage = {
  id: string;
  name: string;
  tier?: string;
  billing: 'Aylık' | 'Yıllık';
  startedAt: string;
  renewsAt: string;
  status: PackageStatus;
  autoRenew: boolean;
  features: string[];
  usage?: { label: string; used: number; limit: number }[];
};

const ACTIVE_KEY = '@active_packages';
const SEED_FLAG_KEY = '@active_packages_seeded';
const ORDERS_KEY = '@orders';

/* ---------------- helpers ---------------- */

const fmtDate = (iso?: string) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? '-'
    : d.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
};

const daysLeft = (endIso?: string) => {
  if (!endIso) return 0;
  const end = new Date(endIso).getTime();
  const now = Date.now();
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
};

const monthsForName = (name: string) => {
  const t = name.toLowerCase();
  if (/kurumsal|pro|premium/.test(t)) return 24;
  if (/standart|standard/.test(t)) return 12;
  if (/başlangıç|starter|temel|basic/.test(t)) return 6;
  return 12;
};

const tierOf = (name: string) => {
  const t = name.toLowerCase();
  if (t.includes('silver')) return 'Silver';
  if (t.includes('gold')) return 'Gold';
  if (t.includes('pro') || t.includes('premium')) return 'Pro';
  return undefined;
};

const pillColor = (tier?: string) =>
  (tier || '').toLowerCase().includes('silver') ? '#1f2a44'
  : (tier || '').toLowerCase().includes('gold')   ? '#a16207'
  : '#334155';

const featureGuess = (name: string): string[] => {
  const t = name.toLowerCase();
  if (t.includes('kurumsal') || t.includes('pro') || t.includes('premium')) {
    return ['Sınırsız Ürün', 'B2B / Pazaryeri Entegrasyon', 'Gelişmiş Raporlama', 'Öncelikli Destek'];
  }
  if (t.includes('standart') || t.includes('standard')) {
    return ['Sınırsız Ürün', 'Gelişmiş Tema', 'Çoklu Kargo', 'SSL + CDN'];
  }
  return ['50-100 Ürün Limiti', 'Tema Seçimi', 'SSL Sertifikası', 'Temel Raporlar'];
};

const billingOf = (months: number): 'Aylık' | 'Yıllık' => (months >= 12 ? 'Yıllık' : 'Aylık');

const toUi = (s: StoredActivation): UiPackage => {
  const rem = daysLeft(s.endDate);
  const months = monthsForName(s.name);
  return {
    id: s.id,
    name: s.name,
    tier: tierOf(s.name),
    billing: billingOf(months),
    startedAt: fmtDate(s.startDate),
    renewsAt: fmtDate(s.endDate),
    status:
      s.status === 'expired'
        ? 'suspended'
        : rem <= 14
          ? 'expiring'
          : 'active',
    autoRenew: s.autoRenew !== false, // varsayılan true
    features: featureGuess(s.name),
    usage: undefined,
  };
};

const extendMonths = (isoStartOrEnd: string, months: number) => {
  const d = new Date(isoStartOrEnd);
  if (isNaN(d.getTime())) return new Date().toISOString();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
};

/* ---------------- screen ---------------- */

export default function ActivePackagesScreen({ navigation }: any) {
  const [uiPackages, setUiPackages] = useState<UiPackage[]>([]);
  const { setStatsFromOrders } = useUser() as any;
  const refreshStats = useCallback(async () => {
    try { await setStatsFromOrders?.(); } catch {}
  }, [setStatsFromOrders]);

  const loadFromStorage = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(ACTIVE_KEY);
      const arr: StoredActivation[] = raw ? JSON.parse(raw) : [];

      // süresi dolanları işaretle
      const today = Date.now();
      let changed = false;

      // 👇 TİPİ KESİNLEŞTİR: StoredActivation[] + 'expired' as const
      const normalized: StoredActivation[] = arr.map((a: StoredActivation): StoredActivation => {
        const expired = new Date(a.endDate).getTime() < today;
        if (expired && a.status !== 'expired') {
          changed = true;
          return { ...a, status: 'expired' as const };
        }
        return a;
        });

      if (changed) await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(normalized));

      setUiPackages(normalized.map(toUi));
      await refreshStats();
    } catch (e) {
      console.warn('active load error', e);
      setUiPackages([]);
    }
  }, [refreshStats]);

  /** Güvenlik ağı: aktif paketler hiç yoksa siparişlerden ilk açılışta üret */
  const seedFromOrdersIfNeeded = useCallback(async () => {
    try {
      const [flag, rawPkgs, rawOrders] = await Promise.all([
        AsyncStorage.getItem(SEED_FLAG_KEY),
        AsyncStorage.getItem(ACTIVE_KEY),
        AsyncStorage.getItem(ORDERS_KEY),
      ]);
      if (flag === '1') return;
      const cur: StoredActivation[] = rawPkgs ? JSON.parse(rawPkgs) : [];
      if (Array.isArray(cur) && cur.length) return;

      const orders = rawOrders ? JSON.parse(rawOrders) : [];
      if (!Array.isArray(orders) || !orders.length) return;

      const list: StoredActivation[] = [];
      for (const o of orders) {
        const now = new Date(o.date || new Date().toISOString());
        for (const it of (o.items || [])) {
          const months = monthsForName(String(it.name || 'Paket'));
          const end = extendMonths(now.toISOString(), months);
          list.unshift({
            id: `AP-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
            name: String(it.name || 'Paket'),
            qty: Number(it.qty || 1),
            startDate: now.toISOString(),
            endDate: end,
            status: 'active',
            orderId: String(o.id || ''),
            panelUrl: undefined,
            autoRenew: true,
          });
        }
      }
      if (list.length) {
        await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(list));
        await AsyncStorage.setItem(SEED_FLAG_KEY, '1');
      }
    } catch (e) {
      console.warn('seedFromOrdersIfNeeded error', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        await seedFromOrdersIfNeeded();
        await loadFromStorage();
      })();
    }, [loadFromStorage, seedFromOrdersIfNeeded])
  );

  const persist = async (mutate: (prev: StoredActivation[]) => StoredActivation[]) => {
    const raw = await AsyncStorage.getItem(ACTIVE_KEY);
    const prev: StoredActivation[] = raw ? JSON.parse(raw) : [];
    const next = mutate(prev);
    await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(next));
    setUiPackages(next.map(toUi));
    await refreshStats();
  };

  /* -------- actions -------- */

  const toggleAutoRenew = async (id: string, val: boolean) => {
    await persist(prev => prev.map(p => (p.id === id ? { ...p, autoRenew: val } : p)));
    Alert.alert('Otomatik yenileme', val ? 'Etkinleştirildi.' : 'Kapatıldı.');
  };

  const cancelPackage = async (id: string, name: string) => {
    Alert.alert(
      'Paketi İptal Et',
      `${name} paketini iptal etmek istiyor musun?\nMevcut dönem sonuna kadar erişimin devam eder.`,
      [
        { text: 'Vazgeç' },
        {
          text: 'İptal Et',
          style: 'destructive',
          onPress: async () => {
            await persist(prev =>
              prev.map(p => (p.id === id ? { ...p, status: 'expired', autoRenew: false } : p))
            );
          },
        },
      ]
    );
  };

  const renewPlus12 = async (id: string) => {
    await persist(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        const base = p.status === 'expired' ? p.startDate : p.endDate;
        return {
          ...p,
          endDate: extendMonths(base, 12),
          status: 'active',
          autoRenew: true,
        };
      })
    );
    Alert.alert('Yenilendi', 'Paket süresi 12 ay uzatıldı.');
  };

  /* -------- render -------- */

  const packages = uiPackages;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Aktif Paketlerim</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {packages.map(p => (
          <View key={p.id} style={styles.card}>
            {/* Başlık satırı */}
            <View style={styles.rowSpace}>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  {!!p.tier && (
                    <View style={[styles.tierPill, { backgroundColor: pillColor(p.tier) }]}>
                      <Text style={styles.tierText}>{p.tier}</Text>
                    </View>
                  )}
                  <Text style={styles.pkgName}>{p.name}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Chip icon="time-outline" text={`Yenileme: ${p.renewsAt}`} />
                  <Chip icon="card-outline" text={p.billing} />
                  <StatusPill status={p.status} />
                </View>
              </View>
            </View>

            {/* Özellikler */}
            <View style={{ marginTop: 12 }}>
              {p.features.slice(0, 4).map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            {/* Aksiyonlar */}
            <View style={styles.actionsRow}>
              <View style={styles.renewRow}>
                <Text style={styles.autoLabel}>Otomatik yenileme</Text>
                <Switch
                  value={p.autoRenew}
                  onValueChange={(v) => toggleAutoRenew(p.id, v)}
                  trackColor={{ false: '#d1d5db', true: COLORS.primary }}
                  thumbColor="#fff"
                  ios_backgroundColor="#d1d5db"
                />
              </View>

              <View style={styles.buttonsRow}>
                <Pressable onPress={() => renewPlus12(p.id)} style={styles.lightBtn} android_ripple={{ color: '#e6e8ee' }}>
                  <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.lightBtnText}>+12 Ay Yenile</Text>
                </Pressable>
                <Pressable onPress={() => cancelPackage(p.id, p.name)} style={styles.dangerBtn} android_ripple={{ color: '#f3c2c2' }}>
                  <Ionicons name="close-circle-outline" size={16} color="#fff" />
                  <Text style={styles.dangerText}>İptal</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}

        {!packages.length && (
          <Text style={{ color: COLORS.muted, marginTop: 12 }}>
            Aktif paket bulunmuyor. Mağazan için uygun paketi seçmek üzere fiyatlandırma sayfasına gidebilirsin.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------- küçük bileşenler ---------------- */

const Chip = ({ icon, text }: { icon: any; text: string }) => (
  <View style={styles.chip}>
    <Ionicons name={icon} size={14} color={COLORS.muted} />
    <Text style={styles.chipText}>{text}</Text>
  </View>
);

const StatusPill = ({ status }: { status: PackageStatus }) => {
  const bg =
    status === 'active' ? '#16a34a' :
    status === 'expiring' ? '#eab308' :
    status === 'pending' ? '#3b82f6' :
    '#ef4444';
  const label =
    status === 'active' ? 'Aktif' :
    status === 'expiring' ? 'Yakında yenilenecek' :
    status === 'pending' ? 'Beklemede' :
    'Askıda';
  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
};

/* ---------------- stiller ---------------- */

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
    marginBottom: 12,
  },

  rowSpace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  tierText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  pkgName: { fontSize: 16, fontWeight: '800', color: COLORS.text },

  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipText: { color: COLORS.muted, fontSize: 12 },

  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  /* özellik listesi */
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  featureText: { color: COLORS.text, fontSize: 13 },

  /* aksiyonlar */
  actionsRow: { marginTop: 14, gap: 10 },
  renewRow: {
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  autoLabel: { color: COLORS.text, fontWeight: '700' },

  buttonsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
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

  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
  },
  dangerText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
