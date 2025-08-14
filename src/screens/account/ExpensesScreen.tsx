// src/screens/account/ExpensesScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl, Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../theme';
import { useUser } from '../../context/user';
import { loadUserData, saveUserData } from '../../utils/userStorage';

type Expense = { id: string; title: string; amount: number; date: string };
const EXPENSES_KEY = 'expenses';

export default function ExpensesScreen({ navigation }: any) {
  const { user } = useUser();

  // UserProfile tipinde id yoksa bile güvenli kullanıcı anahtarı üret
  const userId = useMemo<string | null>(() => {
    const u = user as any;
    return (u?.id || u?.email || u?.uid || u?.userId || null) as string | null;
  }, [user]);

  const [list, setList] = useState<Expense[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');

  const onBack = () =>
    navigation?.canGoBack?.() ? navigation.goBack() : navigation?.navigate?.('AccountHome');

  const load = useCallback(async () => {
    if (!userId) return;
    const data = (await loadUserData<Expense[]>(userId, EXPENSES_KEY)) ?? [];
    setList(Array.isArray(data) ? data : []);
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const add = async () => {
    if (!userId) return;
    const amt = Number(String(amount).replace(',', '.')) || 0;
    if (!title.trim() || amt <= 0) {
      Alert.alert('Uyarı', 'Başlık ve tutarı doğru girin.');
      return;
    }
    const exp: Expense = {
      id: `exp_${Date.now()}`,
      title: title.trim(),
      amount: amt,
      date: new Date().toISOString().slice(0, 10),
    };
    const next = [exp, ...list];
    await saveUserData(userId, EXPENSES_KEY, next);
    setList(next);
    setTitle('');
    setAmount('');
  };

  const remove = async (id: string) => {
    if (!userId) return;
    const next = list.filter((e) => e.id !== id);
    await saveUserData(userId, EXPENSES_KEY, next);
    setList(next);
  };

  if (!userId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={styles.header}>
          <Pressable onPress={onBack} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Harcamalarım</Text>
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
        <Text style={styles.headerTitle}>Harcamalarım</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Ekleme formu */}
        <Text style={styles.sectionTitle}>Harcama Ekle</Text>
        <View style={{ gap: 8, marginBottom: 12 }}>
          <TextInput
            placeholder="Başlık"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
          />
          <TextInput
            placeholder="Tutar (₺)"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <Pressable onPress={add} style={styles.primaryBtn} android_ripple={{ color: '#e6e8ee' }}>
            <Text style={styles.primaryBtnText}>Kaydet</Text>
          </Pressable>
        </View>

        {/* Liste */}
        <Text style={styles.sectionTitle}>Kayıtlar</Text>
        {list.length ? (
          list.map((e) => (
            <View key={e.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{e.title}</Text>
                <Text style={styles.rowSub}>{e.date}</Text>
              </View>
              <Text style={styles.rowPrice}>₺{e.amount.toLocaleString('tr-TR')}</Text>
              <Pressable onPress={() => remove(e.id)} hitSlop={8} style={{ marginLeft: 8 }}>
                <Ionicons name="trash-outline" size={20} color="#B91C1C" />
              </Pressable>
            </View>
          ))
        ) : (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Ionicons name="file-tray-outline" size={22} color={COLORS.muted} />
            <Text style={{ color: COLORS.muted, fontSize: 12 }}>Henüz kayıt yok.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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

  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.muted, marginBottom: 8 },

  input: {
    height: 44,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 12,
    backgroundColor: '#fff', color: COLORS.text,
  },

  primaryBtn: {
    height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  row: {
    marginTop: 10,
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
  rowTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  rowSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  rowPrice: { fontSize: 14, fontWeight: '800', color: COLORS.text },
});
