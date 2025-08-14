// src/screens/account/PaymentMethodsScreen.tsx
import React, { useMemo, useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../theme';
import { useUser } from '../../context/user';

// ✅ Ortak cüzdan yardımcıları (tek kaynak)
import {
  loadWallet,
  addCardToWallet,
  setDefaultCard,
  removeCard as removeCardFromWallet,
  getUserId,
  onlyDigits,
  detectBrand,
  type CardBrand,
  type UICard,
} from '../../utils/wallet';

/* ---------- yerel yardımcılar ---------- */

// 1111 1111 1111 1111 formatı (15-19 hane destek)
const groupCardNumber = (digits: string) =>
  onlyDigits(digits).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ').trim();

const formatExpiry = (val: string) => {
  const d = onlyDigits(val).slice(0, 4);
  if (d.length <= 2) return d;
  return d.slice(0, 2) + '/' + d.slice(2);
};

const luhnValid = (digits: string) => {
  let sum = 0, dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (dbl) { n *= 2; if (n > 9) n -= 9; }
    sum += n; dbl = !dbl;
  }
  return sum % 10 === 0;
};

const maskLast4 = (last4: string) => `•••• •••• •••• ${last4}`;
const brandColor = (b: CardBrand) =>
  b === 'Visa' ? '#1a237e'
  : b === 'Mastercard' ? '#b71c1c'
  : b === 'Amex' ? '#1565c0'
  : b === 'Troy' ? '#0f766e'
  : '#6b7280';

const Label = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ color: COLORS.muted, marginBottom: 6, fontSize: 12 }}>{children}</Text>
);

/* ---------- ekran ---------- */

export default function PaymentMethodsScreen({ navigation }: any) {
  const { user } = useUser();

  // ✅ Kullanıcı kimliğini tutarlı üret (iOS/Android aynı)
  const userId = useMemo<string | null>(() => getUserId(user), [user]);

  const [cards, setCards] = useState<UICard[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);

  // modal state (yeni kart ekleme)
  const [open, setOpen] = useState(false);
  const [numInput, setNumInput] = useState(''); // #### #### #### ####
  const [holder, setHolder] = useState('');
  const [expiry, setExpiry] = useState('');     // MM/YY
  const [cvv, setCvv] = useState('');

  const rawDigits = useMemo(() => onlyDigits(numInput), [numInput]);
  const newBrand  = useMemo<CardBrand>(() => detectBrand(rawDigits), [rawDigits]);

  const resetForm = () => { setNumInput(''); setHolder(''); setExpiry(''); setCvv(''); };

  const loadFromWallet = useCallback(async () => {
    if (!userId) return;
    const store = await loadWallet(userId);
    setCards(store.list);
    setDefaultId(store.defaultId);
  }, [userId]);

  useFocusEffect(useCallback(() => { loadFromWallet(); }, [loadFromWallet]));

  const addCard = async () => {
    if (!userId) return;

    const digits = onlyDigits(numInput);
    // Amex 15; diğerleri genelde 16 (basit kontrol)
    const lenOk = newBrand === 'Amex' ? digits.length === 15 : digits.length === 16;
    if (!lenOk || !luhnValid(digits)) {
      Alert.alert('Kart numarası geçersiz', 'Geçerli bir kart numarası girin.');
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      Alert.alert('Son kullanma geçersiz', 'Lütfen MM/YY formatında girin.');
      return;
    }
    if (!(cvv.length === 3 || (newBrand === 'Amex' && cvv.length === 4))) {
      Alert.alert('CVV geçersiz', newBrand === 'Amex' ? 'CVV 4 haneli olmalı.' : 'CVV 3 haneli olmalı.');
      return;
    }

    const newCard: UICard = {
      id: `card_${Date.now()}`,
      brand: newBrand,
      holder: (holder || 'Ad Soyad').trim(),
      last4: digits.slice(-4),
      expiry,
    };

    await addCardToWallet(userId, newCard);
    await loadFromWallet();

    setOpen(false);
    resetForm();
    Alert.alert('Kart eklendi', 'Kart başarıyla kaydedildi.');
  };

  const removeCard = async (id: string) => {
    if (!userId) return;
    Alert.alert('Kartı Sil', 'Bu kartı kaldırmak istiyor musunuz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await removeCardFromWallet(userId, id);
          await loadFromWallet();
        },
      },
    ]);
  };

  const makeDefault = async (id: string) => {
    if (!userId) return;
    await setDefaultCard(userId, id);
    await loadFromWallet();
  };

  const onBack = () => (navigation.canGoBack?.() ? navigation.goBack() : navigation.navigate('AccountHome'));

  if (!userId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={styles.header}>
          <Pressable onPress={onBack} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Ödeme Yöntemlerim</Text>
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
        <Text style={styles.headerTitle}>Ödeme Yöntemlerim</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Kart Ekle */}
        <Pressable style={styles.addBtn} onPress={() => setOpen(true)} android_ripple={{ color: '#e6e8ee' }}>
          <Ionicons name="add" size={18} color={COLORS.primary} />
          <Text style={styles.addBtnText}>Kart Ekle</Text>
        </Pressable>

        {/* Kayıtlı kartlar */}
        <View style={{ marginTop: 12 }}>
          {cards.length ? cards.map((card) => {
            const isDefault = card.id === defaultId;
            return (
              <View key={card.id} style={styles.cardRow}>
                <View style={[styles.brandBadge, { backgroundColor: brandColor(card.brand) }]}>
                  <Text style={styles.brandText}>{card.brand}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{maskLast4(card.last4)}</Text>
                  <Text style={styles.cardSub}>{card.holder} • SKT {card.expiry}</Text>
                </View>

                {isDefault ? (
                  <View style={styles.defaultPill}><Text style={styles.defaultText}>Varsayılan</Text></View>
                ) : (
                  <Pressable onPress={() => makeDefault(card.id)} hitSlop={8}>
                    <Ionicons name="star-outline" size={20} color={COLORS.muted} />
                  </Pressable>
                )}
                <Pressable onPress={() => removeCard(card.id)} hitSlop={8} style={{ marginLeft: 8 }}>
                  <Ionicons name="trash-outline" size={20} color="#B91C1C" />
                </Pressable>
              </View>
            );
          }) : (
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: COLORS.muted }}>
                Kayıtlı kart yok. “Kart Ekle” ile yeni bir kart kaydedin.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Kart Ekle Modal */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yeni Kart</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </Pressable>
            </View>

            <View style={{ gap: 10 }}>
              <Label> Kart Numarası ({newBrand}) </Label>
              <TextInput
                value={numInput}
                onChangeText={(t) => setNumInput(groupCardNumber(t))}
                keyboardType="number-pad"
                placeholder="#### #### #### ####"
                style={styles.input}
                maxLength={23}
              />

              <Label> Kart Üzerindeki İsim </Label>
              <TextInput
                value={holder}
                onChangeText={setHolder}
                placeholder="Ad Soyad"
                style={styles.input}
                autoCapitalize="words"
                maxLength={55}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Label> Son Kullanma </Label>
                  <TextInput
                    value={expiry}
                    onChangeText={(t) => setExpiry(formatExpiry(t))}
                    keyboardType="number-pad"
                    placeholder="MM/YY"
                    style={styles.input}
                    maxLength={5}
                  />
                </View>
                <View style={{ width: 110 }}>
                  <Label> CVV </Label>
                  <TextInput
                    value={cvv}
                    onChangeText={(t) => setCvv(onlyDigits(t).slice(0, newBrand === 'Amex' ? 4 : 3))}
                    keyboardType="number-pad"
                    placeholder="CVV"
                    style={styles.input}
                    maxLength={newBrand === 'Amex' ? 4 : 3}
                    secureTextEntry
                  />
                </View>
              </View>
            </View>

            <Pressable onPress={addCard} style={[styles.primaryBtn, { marginTop: 16 }]} android_ripple={{ color: '#e6e8ee' }}>
              <Text style={styles.primaryBtnText}>Kaydet</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------- stylesheet ---------- */
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

  addBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, backgroundColor: '#fff',
  },
  addBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },

  cardRow: {
    marginTop: 12,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  brandBadge: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    minWidth: 60,
    alignItems: 'center',
  },
  brandText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  cardSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },

  defaultPill: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  defaultText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  /* modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16,24,40,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  input: {
    height: 44,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 12,
    backgroundColor: '#fff', color: COLORS.text,
  },

  primaryBtn: {
    marginTop: 8,
    height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
