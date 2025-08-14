// src/screens/CartScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, Pressable,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCart } from '../components/sepeteekle';
import { useUser } from '../context/user';

const PRIMARY = '#374581';
const MAX_DIGITS = 16;   // 🔒 kart numarası 16 hane
const CVV_LENGTH = 3;    // 🔒 CVV kesinlikle 3 hane

type CartItem = { id: string; name: string; price?: number; qty: number };

type Order = {
  id: string;
  date: string;
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

// ------------- helpers -------------
const digits = (s: string) => String(s || '').replace(/\D+/g, '');
const detectBrand = (num: string) => {
  if (/^4/.test(num)) return 'Visa';
  if (/^5[1-5]/.test(num)) return 'Mastercard';
  if (/^(34|37)/.test(num)) return 'Amex';
  if (/^9792/.test(num)) return 'Troy';
  return 'Bilinmiyor';
};
const luhnOk = (num: string) => {
  const d = digits(num);
  if (d.length !== MAX_DIGITS) return false; // 🔒 yalnızca 16 hane kabul
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = +d[i];
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
};
const formatCard = (val: string) => {
  const d = digits(val).slice(0, MAX_DIGITS); // 16 hane
  return d.replace(/(.{4})/g, '$1 ').trim();  // 4'lü gruplar
};
const formatExpiry = (val: string) => {
  const d = digits(val).slice(0, 4);
  if (d.length <= 2) return d;
  return d.slice(0, 2) + '/' + d.slice(2);
};
const validExpiry = (e: string) => {
  const m = e.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return false;
  const mm = +m[1];
  const yy = 2000 + +m[2];
  if (mm < 1 || mm > 12) return false;
  const now = new Date();
  const nowYM = now.getFullYear() * 100 + (now.getMonth() + 1);
  const expYM = yy * 100 + mm;
  return expYM >= nowYM; // geçmiş ay/yıl değilse geçerli
};
// ✅ siparişleri kullanıcıya özel anahtarla tut
const ordersKey = (u: any) => `@orders:${u?.id || u?.email || 'guest'}`;

export default function CartScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { items, total, remove, clear, inc, dec } = useCart();

  // ✅ istatistik güncellemesi için addOrder
  const { user, updateProfile, addOrder } = useUser();

  // rozet: toplam adet
  const totalQty = useMemo(() => items.reduce((s, it) => s + (it.qty || 0), 0), [items]);
  const totalText = useMemo(() => `₺${Number(total).toLocaleString('tr-TR')}`, [total]);

  // kayıtlı kartlar
  const savedCards = user.paymentMethods ?? [];
  const defaultCard = savedCards.find(c => c.id === user.defaultPaymentId) ?? savedCards[0];

  // checkout state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | 'NEW'>(defaultCard?.id ?? 'NEW');

  // yeni kart
  const [holder, setHolder] = useState(
    user.firstName || user.lastName ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : (user.name ?? '')
  );
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState(''); // MM/YY
  const [cvv, setCvv] = useState('');      // tam 3 hane

  const renderItem = ({ item }: { item: CartItem }) => (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => dec(item.id)}>
            <Text style={styles.qtyBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.meta}>Adet: <Text style={{ fontWeight: '700' }}>{item.qty}</Text></Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => inc(item.id)}>
            <Text style={styles.qtyBtnText}>+</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.price}>₺{((item.price ?? 0) * item.qty).toLocaleString('tr-TR')}</Text>
      </View>

      <TouchableOpacity style={styles.trash} onPress={() => remove(item.id)}>
        <FontAwesome name="trash" size={16} color={PRIMARY} />
      </TouchableOpacity>
    </View>
  );

  const openCheckout = () => {
    if (!items.length) {
      Alert.alert('Sepet boş', 'Ödeme yapmak için önce ürün ekleyin.');
      return;
    }
    setSelectedCardId(defaultCard?.id ?? 'NEW'); // varsayılan kartı seç
    setCheckoutOpen(true);
  };

  const makeOrder = async () => {
    try {
      // ✅ clear() sonrası total sıfırlanmasın
      const orderTotal = total;

      let brand = '';
      let last4 = '';
      let holderName = '';
      let exp = '';

      if (selectedCardId !== 'NEW') {
        const card = savedCards.find(c => c.id === selectedCardId);
        if (!card) return Alert.alert('Kart', 'Kart bulunamadı.');
        brand = card.brand as any;
        last4 = card.last4;
        holderName = card.holder;
        exp = card.expiry;
      } else {
        const raw = digits(number);
        if (raw.length !== MAX_DIGITS) return Alert.alert('Kart', 'Kart numarası 16 hane olmalıdır.');
        if (!luhnOk(raw)) return Alert.alert('Kart', 'Kart numarası geçersiz görünüyor.');
        if (!validExpiry(expiry)) return Alert.alert('Kart', 'Son kullanma tarihi geçersiz.');
        if (digits(cvv).length !== CVV_LENGTH) return Alert.alert('Kart', `CVV ${CVV_LENGTH} haneli olmalıdır.`);
        brand = detectBrand(raw) as any;
        last4 = raw.slice(-4);
        holderName = (holder || 'Müşteri').trim();
        exp = expiry;

        // yeni kartı profilde sakla ve varsayılan yap
        const newCard = {
          id: `card_${Date.now()}`,
          brand: brand as any,
          holder: holderName,
          last4,
          expiry: exp,
        };
        const next = [...(user.paymentMethods ?? []), newCard];
        updateProfile({ paymentMethods: next, defaultPaymentId: newCard.id });
        setSelectedCardId(newCard.id);
      }

      // 🗂️ siparişi kullanıcıya özel anahtara yaz
      const key = ordersKey(user);
      const now = new Date();
      const orderId = `ORD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${now.getTime().toString().slice(-6)}`;
      const invoiceNo = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 9000 + 1000)}`;

      const order: Order = {
        id: orderId,
        date: now.toISOString(),
        items: items.map(i => ({ ...i })),
        total: orderTotal,
        status: 'paid',
        payment: { brand, last4, holder: holderName, expiry: exp },
        invoiceNo,
        invoice: {
          no: invoiceNo,
          date: now.toISOString(),
          buyer: {
            name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name,
            email: user.email,
            address: user.address,
          },
          lines: items.map(i => ({
            name: i.name,
            qty: i.qty,
            unitPrice: i.price ?? 0,
            lineTotal: (i.price ?? 0) * i.qty,
          })),
          total: orderTotal,
          currency: 'TRY',
        },
      };

      const rawOrders = await AsyncStorage.getItem(key);
      const arr = rawOrders ? JSON.parse(rawOrders) : [];
      const nextOrders = Array.isArray(arr) ? arr : [];
      nextOrders.unshift(order);
      await AsyncStorage.setItem(key, JSON.stringify(nextOrders));

      // ✅ sayaçları güncelle (orders +1, spend += orderTotal)
      await addOrder(orderTotal);

      clear();
      setCheckoutOpen(false);

      Alert.alert('Ödeme başarılı', `Siparişiniz oluşturuldu.\nFatura No: ${invoiceNo}`, [
        { text: 'Siparişlerim', onPress: () => navigation.navigate('Hesabım' as never, { screen: 'Orders' } as never) },
        { text: 'Tamam' },
      ]);
    } catch (e) {
      console.warn('order error', e);
      Alert.alert('Hata', 'Ödeme sırasında bir sorun oluştu.');
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <FontAwesome name="arrow-left" size={20} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sepetim</Text>
        <View style={{ width: 36 }} />
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ color: '#6b7280' }}>Sepetiniz boş.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 140 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Alt toplam bar */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#6b7280' }}>Toplam</Text>
          <Text style={styles.total}>{totalText}</Text>
        </View>

        {/* sepette toplam adet */}
        <View style={styles.badgeWrap}>
          <Text style={styles.badgeText}>{totalQty}</Text>
        </View>

        <TouchableOpacity style={styles.clearBtn} onPress={clear}>
          <Text style={styles.clearText}>Temizle</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.confirmBtn} onPress={openCheckout}>
          <Text style={styles.confirmText}>Sepeti Onayla</Text>
        </TouchableOpacity>
      </View>

      {/* Checkout Modal */}
      <Modal visible={checkoutOpen} animationType="slide" transparent onRequestClose={() => setCheckoutOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCheckoutOpen(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.sheet, { paddingBottom: 12 + insets.bottom }]}
        >
          <Text style={styles.sheetTitle}>Ödeme</Text>

          {/* Kayıtlı kartlar */}
          {!!savedCards.length && (
            <View style={{ marginTop: 8 }}>
              {savedCards.map(c => {
                const active = selectedCardId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    style={[styles.cardRow, active && styles.cardRowActive]}
                    onPress={() => setSelectedCardId(c.id)}
                  >
                    <Text style={styles.cardRowText}>
                      {c.brand} •••• {c.last4} <Text style={{ color: '#6b7280' }}>({c.expiry})</Text>
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Yeni kart */}
          <Pressable
            style={[styles.cardRow, selectedCardId === 'NEW' && styles.cardRowActive]}
            onPress={() => setSelectedCardId('NEW')}
          >
            <Text style={styles.cardRowText}>+ Yeni Kart ile Öde</Text>
          </Pressable>

          {selectedCardId === 'NEW' && (
            <View style={{ marginTop: 8, gap: 8 }}>
              <TextInput
                placeholder="Kart Üzerindeki İsim"
                value={holder}
                onChangeText={setHolder}
                style={styles.input}
                placeholderTextColor="#9ca3af"
              />
              <TextInput
                placeholder="Kart Numarası"
                value={number}
                onChangeText={(t) => setNumber(formatCard(t))}
                keyboardType="number-pad"
                style={styles.input}
                placeholderTextColor="#9ca3af"
                maxLength={19} // 16 digit + 3 boşluk
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  placeholder="AA/YY"
                  value={expiry}
                  onChangeText={(t) => setExpiry(formatExpiry(t))}
                  keyboardType="number-pad"
                  style={[styles.input, { flex: 1 }]}
                  placeholderTextColor="#9ca3af"
                  maxLength={5}
                />
                <TextInput
                  placeholder="CVV"
                  value={cvv}
                  onChangeText={(t) => setCvv(digits(t).slice(0, CVV_LENGTH))}
                  keyboardType="number-pad"
                  style={[styles.input, { flex: 1 }]}
                  placeholderTextColor="#9ca3af"
                  maxLength={CVV_LENGTH}
                  secureTextEntry
                />
              </View>
            </View>
          )}

          <View style={styles.sheetActions}>
            <Pressable style={styles.cancelBtn} onPress={() => setCheckoutOpen(false)}>
              <Text style={styles.cancelText}>Vazgeç</Text>
            </Pressable>
            <Pressable style={styles.payBtn} onPress={makeOrder}>
              <Text style={styles.payText}>Ödemeyi Yap</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#111827' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  meta: { color: '#6b7280' },
  qtyBtn: {
    width: 30, height: 30, borderRadius: 8,
    borderWidth: 1, borderColor: '#e5e7eb',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  qtyBtnText: { fontSize: 18, fontWeight: '800', color: '#111827', lineHeight: 22 },

  price: { marginTop: 8, fontWeight: '700', color: '#111827' },

  trash: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: '#eef2ff',
    alignItems: 'center', justifyContent: 'center',
  },

  footer: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#eef0f3',
    backgroundColor: '#ffffffee',
  },
  total: { fontSize: 18, fontWeight: '800', color: '#111827' },

  // rozet: toplam adet
  badgeWrap: {
    minWidth: 28, height: 28, borderRadius: 14,
    paddingHorizontal: 8,
    backgroundColor: '#111827',
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontWeight: '800' },

  clearBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#eaf0ff',
  },
  clearText: { color: PRIMARY, fontWeight: '700' },
  confirmBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: PRIMARY,
  },
  confirmText: { color: '#fff', fontWeight: '700' },

  // checkout sheet
  backdrop: { position: 'absolute', inset: 0, backgroundColor: '#0009' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 8,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  cardRow: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: '#fff', marginTop: 8,
  },
  cardRowActive: { borderColor: PRIMARY, backgroundColor: '#f5f7ff' },
  cardRowText: { color: '#111827', fontWeight: '700' },

  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
  },

  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center' },
  cancelText: { color: '#111827', fontWeight: '700' },
  payBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: PRIMARY, alignItems: 'center' },
  payText: { color: '#fff', fontWeight: '800' },
});
