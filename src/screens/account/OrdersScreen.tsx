// src/screens/account/OrdersScreen.tsx
import React, { useMemo, useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Alert,
  RefreshControl,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { COLORS } from '../../theme';
import { useUser } from '../../context/user';
import { useCart } from '../../components/sepeteekle';

// ✅ kullanıcıya özel depolama
import { loadUserData, saveUserData } from '../../utils/userStorage';

type OrderStatus = 'hazirlaniyor' | 'teslim' | 'iptal';

/* ---------- PANEL/HİZMET tipleri (kullanıcıya özel depolama) ---------- */
type PanelOrderItem = {
  plan: string;
  tier: 'Starter' | 'Silver' | 'Gold';
  term: string;
  qty: number;
  price: number;
};

type PanelOrder = {
  id: string;
  date: string;
  status: OrderStatus;
  items: PanelOrderItem[];
  panelUrl?: string;
  adminEmail?: string;
  activeUntil?: string;
  note?: string;
};

const statusLabel = (s: OrderStatus) =>
  s === 'teslim' ? 'Teslim edildi' : s === 'hazirlaniyor' ? 'Hazırlanıyor' : 'İptal edildi';

const statusColors: Record<OrderStatus, { bg: string; text: string; border: string }> = {
  teslim: { bg: '#E9F8EE', text: '#067647', border: '#B7E4C7' },
  hazirlaniyor: { bg: '#FFF6E6', text: '#B54708', border: '#F3D19E' },
  iptal: { bg: '#FDECEC', text: '#B42318', border: '#F3B4B4' },
};

const tierColors: Record<PanelOrderItem['tier'], string> = {
  Starter: '#6b7280',
  Silver: '#1f2a44',
  Gold: '#b45309',
};

/* ---------- MAĞAZA (sepette oluşturulan) tipleri ---------- */
type CartItem = { id: string; name: string; price?: number; qty: number };

type ShopOrder = {
  id: string;
  date: string; // ISO
  items: CartItem[];
  total: number;
  status: 'paid';
  payment: { brand: string; last4: string; holder: string; expiry: string };
  invoiceNo: string;
  invoice: {
    no: string;
    date: string;
    buyer: { name?: string; email?: string; address?: string };
    lines: Array<{ name: string; qty: number; unitPrice: number; lineTotal: number }>;
    total: number;
    currency: 'TRY';
  };
};

/* -------------- Helpers -------------- */
const currency = (n: number) => `₺${Number(n).toLocaleString('tr-TR')}`;
const formatDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
};

/* -------------- Storage Keys (userStorage ile kullanıcıya özel) -------------- */
const SHOP_ORDERS_KEY = 'orders';
const SERVICE_ORDERS_KEY = 'service_orders';

export default function OrdersScreen({ navigation }: any) {
  const nav = useNavigation<any>();
  const { user, hydrateFromStorage } = useUser();

  // ✅ UserProfile'da id olmasa bile güvenli userId
  const userId = useMemo<string | null>(() => {
    const u = user as any;
    return (u?.id || u?.email || u?.uid || u?.userId || null) as string | null;
  }, [user]);

  const [filter, setFilter] = useState<'Tümü' | 'Hazırlanıyor' | 'Teslim edildi' | 'İptal'>('Tümü');
  const [shopOrders, setShopOrders] = useState<ShopOrder[]>([]);
  const [serviceOrders, setServiceOrders] = useState<PanelOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadShopOrders = useCallback(async () => {
    if (!userId) return;
    const data = (await loadUserData<ShopOrder[]>(userId, SHOP_ORDERS_KEY)) ?? [];
    setShopOrders(Array.isArray(data) ? data : []);
  }, [userId]);

  const loadServiceOrders = useCallback(async () => {
    if (!userId) return;
    let data = await loadUserData<PanelOrder[]>(userId, SERVICE_ORDERS_KEY);
    if (!data) {
      data = [];
      await saveUserData(userId, SERVICE_ORDERS_KEY, data);
    }
    setServiceOrders(Array.isArray(data) ? data : []);
  }, [userId]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await Promise.all([
        loadShopOrders(),
        loadServiceOrders(),
        hydrateFromStorage?.() || Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [loadShopOrders, loadServiceOrders, hydrateFromStorage]);

  useFocusEffect(
    useCallback(() => {
      void loadShopOrders();
      void loadServiceOrders();
      void (hydrateFromStorage?.() || Promise.resolve());
    }, [loadShopOrders, loadServiceOrders, hydrateFromStorage])
  );

  const filteredService = useMemo(() => {
    if (filter === 'Tümü') return serviceOrders;
    if (filter === 'Hazırlanıyor') return serviceOrders.filter((o) => o.status === 'hazirlaniyor');
    if (filter === 'Teslim edildi') return serviceOrders.filter((o) => o.status === 'teslim');
    return serviceOrders.filter((o) => o.status === 'iptal');
  }, [filter, serviceOrders]);

  // ✅ GERİ DÜZELTME: geçmiş yoksa replace + tab'ı Hesabım'a döndür
  const onBack = () => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation.replace?.('AccountHome');                  // Orders -> AccountHome
      navigation.getParent?.()?.navigate?.('Hesabım');      // tab seçimini garanti et
    }
  };

  if (!userId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={styles.header}>
          <Pressable onPress={onBack} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Siparişlerim</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ padding: 16 }}>
          <Text>Önce giriş yapmalısın.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Siparişlerim</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* --- Mağaza (Sepet) Siparişleri --- */}
        <Text style={styles.sectionTitle}>Mağaza Siparişleri</Text>
        {shopOrders.length ? (
          shopOrders.map((o) => <ShopOrderCard key={o.id} order={o} />)
        ) : (
          <View style={styles.empty}>
            <Ionicons name="file-tray-outline" size={22} color={COLORS.muted} />
            <Text style={styles.emptyText}>Sepetten oluşturulmuş sipariş bulunamadı.</Text>
          </View>
        )}

        {/* --- Hizmet / Panel Siparişleri (kullanıcıya özel) --- */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Hizmet / Panel Siparişleri</Text>

        <View style={styles.filters}>
          {(['Tümü', 'Hazırlanıyor', 'Teslim edildi', 'İptal'] as const).map((f) => {
            const active = filter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
              </Pressable>
            );
          })}
        </View>

        {filteredService.length ? (
          filteredService.map((order) => <PanelOrderCard key={order.id} order={order} />)
        ) : (
          <View style={styles.empty}>
            <Ionicons name="file-tray-outline" size={22} color={COLORS.muted} />
            <Text style={styles.emptyText}>Kayıt bulunamadı.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ------------ Shop (AsyncStorage via userStorage) Card ------------- */

function ShopOrderCard({ order }: { order: ShopOrder }) {
  const { add } = useCart();
  const navigation = useNavigation<any>();
  const dateText = formatDate(order.date);

  const reorder = () => {
    try {
      order.items.forEach((it) => add({ id: it.id, name: it.name, price: it.price ?? 0 }, it.qty));
      Alert.alert('Sepete eklendi', 'Siparişinizdeki ürünler sepete eklendi.', [
        { text: 'Sepete Git', onPress: () => navigation.navigate('Tabs' as never, { screen: 'Cart' } as never) },
        { text: 'Tamam' },
      ]);
    } catch (e) {
      Alert.alert('Hata', 'Tekrar satın alma sırasında bir sorun oluştu.');
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderNo}>Sipariş #{order.id}</Text>
          <Text style={styles.orderDate}>{dateText}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: '#E9F8EE', borderColor: '#B7E4C7' }]}>
          <Text style={[styles.statusText, { color: '#067647' }]}>Ödendi</Text>
        </View>
      </View>

      {order.items.map((it, idx) => (
        <View key={`${order.id}-${idx}`} style={styles.itemRow}>
          <View style={[styles.tierBadge, { backgroundColor: '#111827' }]}>
            <Text style={styles.tierBadgeText}>{it.qty}x</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>{it.name}</Text>
            <Text style={styles.itemSub}>
              Birim: {currency(it.price ?? 0)} • Adet: {it.qty}
            </Text>
          </View>
          <Text style={styles.itemPrice}>{currency((it.price ?? 0) * it.qty)}</Text>
        </View>
      ))}

      <View style={styles.infoBlock}>
        <Row icon="card-outline" text={`${order.payment.brand} •••• ${order.payment.last4} (${order.payment.expiry})`} />
        <Row icon="reader-outline" text={`Fatura No: ${order.invoiceNo}`} />
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.totalText}>
          Toplam: <Text style={{ fontWeight: '800' }}>{currency(order.total)}</Text>
        </Text>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            title="Fatura"
            variant="outline"
            onPress={() =>
              Alert.alert(
                'Fatura Bilgisi',
                `No: ${order.invoice.no}\nTarih: ${formatDate(order.invoice.date)}\nTutar: ${currency(
                  order.invoice.total
                )} ${order.invoice.currency}`
              )
            }
          />
          <Button title="Tekrar Satın Al" onPress={reorder} />
        </View>
      </View>
    </View>
  );
}

/* ------------ Panel (kullanıcıya özel) Card ------------- */

function PanelOrderCard({ order }: { order: PanelOrder }) {
  const { add } = useCart();
  const navigation = useNavigation<any>();
  const total = order.items.reduce((s, it) => s + it.price * it.qty, 0);
  const sc = statusColors[order.status];

  const goToPanel = async () => {
    if (!order.panelUrl) return;
    const ok = await Linking.canOpenURL(order.panelUrl);
    if (ok) Linking.openURL(order.panelUrl);
    else Alert.alert('Bağlantı açılamadı', order.panelUrl);
  };

  const reorder = () => {
    try {
      order.items.forEach((it, idx) => {
        const id = `panel-${order.id}-${idx}`;
        add({ id, name: `${it.plan} (${it.term})`, price: it.price }, it.qty);
      });
      Alert.alert('Sepete eklendi', 'Hizmet/panel siparişi sepete eklendi.', [
        { text: 'Sepete Git', onPress: () => navigation.navigate('Tabs' as never, { screen: 'Cart' } as never) },
        { text: 'Tamam' },
      ]);
    } catch (e) {
      Alert.alert('Hata', 'Tekrar satın alma sırasında bir sorun oluştu.');
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderNo}>Sipariş #{order.id}</Text>
          <Text style={styles.orderDate}>{order.date}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: sc.bg, borderColor: sc.border }]}>
          <Text style={[styles.statusText, { color: sc.text }]}>{statusLabel(order.status)}</Text>
        </View>
      </View>

      {order.items.map((it, idx) => (
        <View key={`${order.id}-panel-${idx}`} style={styles.itemRow}>
          <View style={[styles.tierBadge, { backgroundColor: tierColors[it.tier] }]}>
            <Text style={styles.tierBadgeText}>{it.tier}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>{it.plan}</Text>
            <Text style={styles.itemSub}>
              {it.term} • {it.qty} adet
            </Text>
          </View>
          <Text style={styles.itemPrice}>{currency(it.price)}</Text>
        </View>
      ))}

      {!!order.panelUrl && (
        <View style={styles.infoBlock}>
          <Row icon="globe-outline" text={order.panelUrl} />
          {!!order.adminEmail && <Row icon="mail-outline" text={order.adminEmail} />}
          {!!order.activeUntil && <Row icon="calendar-outline" text={`Geçerlilik: ${order.activeUntil}`} />}
        </View>
      )}
      {!!order.note && !order.panelUrl && (
        <View style={[styles.infoBlock, { backgroundColor: '#F8FAFC' }]}>
          <Row
            icon={order.status === 'hazirlaniyor' ? 'time-outline' : 'close-circle-outline'}
            text={order.note}
          />
        </View>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.totalText}>
          Toplam: <Text style={{ fontWeight: '800' }}>{currency(total)}</Text>
        </Text>

        {order.status === 'teslim' ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Panele Git" onPress={goToPanel} />
            <Button title="Tekrar Satın Al" variant="outline" onPress={reorder} />
          </View>
        ) : order.status === 'hazirlaniyor' ? (
          <Button title="Durumu Gör" variant="outline" onPress={() => Alert.alert('Durum', 'Kurulum devam ediyor.')} />
        ) : (
          <Button title="Tekrar Satın Al" onPress={reorder} />
        )}
      </View>
    </View>
  );
}

/* -------- küçük yardımcılar -------- */

function Row({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Ionicons name={icon} size={16} color={COLORS.muted} />
      <Text style={{ color: COLORS.text, flex: 1 }}>{text}</Text>
    </View>
  );
}

function Button({
  title,
  onPress,
  variant = 'solid',
}: {
  title: string;
  onPress: () => void;
  variant?: 'solid' | 'outline';
}) {
  const solid = variant === 'solid';
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: '#e6e8ee' }}
      style={[
        styles.btn,
        solid
          ? { backgroundColor: COLORS.primary, borderColor: COLORS.primary }
          : { backgroundColor: '#fff' },
      ]}
    >
      <Text style={[styles.btnText, solid ? { color: '#fff' } : { color: COLORS.primary }]}>{title}</Text>
    </Pressable>
  );
}

/* ------------- styles -------------- */
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

  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.muted,
    marginBottom: 8,
  },

  filters: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#fff' },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  orderNo: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  orderDate: { fontSize: 12, color: COLORS.muted, marginTop: 2 },

  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  statusText: { fontSize: 12, fontWeight: '800' },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  tierBadgeText: { color: '#fff', fontWeight: '800', fontSize: 10 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  itemSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: '800', color: COLORS.text },

  infoBlock: {
    marginTop: 8,
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
    padding: 12,
  },

  cardFooter: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalText: { color: COLORS.text, fontSize: 13 },

  btn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontWeight: '800', fontSize: 13 },

  empty: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  emptyText: { color: COLORS.muted, fontSize: 12 },
});
