// src/screens/account/PersonalInfoScreen.tsx
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Image, Modal,
  Alert, Platform, ActionSheetIOS
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../theme';
import { useUser } from '../../context/user';

type Address = {
  id: string;
  label: string;
  line1: string;
  city: string;
  postalCode?: string;
};

/** TR locale: her kelimenin ilk harfi büyük, kalanı küçük */
const titleCaseTR = (s: string) =>
  (s ?? '')
    .toLocaleLowerCase('tr-TR')
    .split(/\s+/)
    .map(w => (w ? w[0].toLocaleUpperCase('tr-TR') + w.slice(1) : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const initials = (name?: string, surname?: string) =>
  [name ?? '', surname ?? '']
    .join(' ')
    .split(' ')
    .filter(Boolean)
    .map(p => p[0]!.toLocaleUpperCase('tr-TR'))
    .slice(0, 2)
    .join('');

const onlyDigits = (s: string) => s.replace(/\D+/g, '');
const normalizeEmail = (e?: string) => (e ?? '').trim().toLowerCase();
const addrKey = (email?: string) => `@addresses:${normalizeEmail(email)}`;

export default function PersonalInfoScreen({ navigation }: any) {
  // context (updateProfile varsa onu kullan, yoksa update)
  const usr = useUser() as any;
  const user = usr.user;
  const applyUpdate: (p: any) => void = (patch) => {
    if (typeof usr.updateProfile === 'function') usr.updateProfile(patch);
    else if (typeof usr.update === 'function') usr.update(patch);
  };

  // Profil
  const [avatarUri, setAvatarUri] = useState<string | null>(user.avatarUri ?? null);

  // Form alanları
  const [firstName, setFirstName] = useState<string>(user.firstName ?? '');
  const [lastName,  setLastName]  = useState<string>(user.lastName ?? '');
  const [email,     setEmail]     = useState<string>(user.email ?? '');
  const [phone,     setPhone]     = useState<string>(user.phone ?? '');

  // Adresler (kalıcı)
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addrModalOpen, setAddrModalOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [addrLabel, setAddrLabel] = useState('');
  const [addrLine1, setAddrLine1] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrPostal, setAddrPostal] = useState('');

  const userInitials = useMemo(() => initials(firstName, lastName), [firstName, lastName]);

  // --- Adresleri yükle
  const loadAddresses = useCallback(async (mail?: string) => {
    try {
      const raw = await AsyncStorage.getItem(addrKey(mail ?? user.email));
      const list: Address[] = raw ? JSON.parse(raw) : [];
      setAddresses(list);
      // ilk adresi ana adres olarak profile de yaz (anlık)
      if (list[0]) {
        const main = `${list[0].label}: ${list[0].line1}, ${list[0].city}${list[0].postalCode ? ' ' + list[0].postalCode : ''}`;
        applyUpdate({ address: main });
      }
    } catch (e) {
      console.warn('loadAddresses error', e);
    }
  }, [user.email]);

  useEffect(() => {
    void loadAddresses();
  }, [loadAddresses]);

  // --- Adresleri kaydet + ana adresi güncelle
  const persistAddresses = useCallback(async (list: Address[], mail?: string) => {
    try {
      await AsyncStorage.setItem(addrKey(mail ?? user.email), JSON.stringify(list));
      setAddresses(list);
      if (list[0]) {
        const main = `${list[0].label}: ${list[0].line1}, ${list[0].city}${list[0].postalCode ? ' ' + list[0].postalCode : ''}`;
        applyUpdate({ address: main });
      } else {
        applyUpdate({ address: '' });
      }
    } catch (e) {
      console.warn('persistAddresses error', e);
    }
  }, [user.email]);

  // Avatar
  const setAvatarAndUpdate = (uri: string | null) => {
    setAvatarUri(uri);
    applyUpdate({ avatarUri: uri });
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('İzin gerekli', 'Profil fotoğrafı seçmek için galeri erişimine izin ver.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (!res.canceled) setAvatarAndUpdate(res.assets[0].uri);
  };

  const removeAvatar = () => {
    Alert.alert('Fotoğrafı Kaldır', 'Profil fotoğrafını kaldırmak istiyor musun?', [
      { text: 'Vazgeç' },
      { text: 'Kaldır', style: 'destructive', onPress: () => setAvatarAndUpdate(null) },
    ]);
  };

  const openAvatarMenu = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Fotoğraf Seç', 'Fotoğrafı Kaldır', 'İptal'],
          cancelButtonIndex: 2,
          destructiveButtonIndex: 1,
          userInterfaceStyle: 'light',
        },
        (i) => { if (i === 0) pickImage(); else if (i === 1) removeAvatar(); }
      );
    } else {
      Alert.alert('Profil Fotoğrafı', 'Bir seçenek seçin', [
        { text: 'Fotoğraf Seç', onPress: pickImage },
        { text: 'Fotoğrafı Kaldır', style: 'destructive', onPress: removeAvatar },
        { text: 'İptal', style: 'cancel' },
      ]);
    }
  };

  // Adres CRUD
  const openAddAddress = () => {
    setEditing(null);
    setAddrLabel(''); setAddrLine1(''); setAddrCity(''); setAddrPostal('');
    setAddrModalOpen(true);
  };

  const openEditAddress = (addr: Address) => {
    setEditing(addr);
    setAddrLabel(addr.label); setAddrLine1(addr.line1);
    setAddrCity(addr.city); setAddrPostal(addr.postalCode ?? '');
    setAddrModalOpen(true);
  };

  const saveAddress = async () => {
    if (!addrLabel || !addrLine1 || !addrCity) {
      Alert.alert('Eksik bilgi', 'Lütfen etiket, adres ve şehir alanlarını doldurun.');
      return;
    }
    let next: Address[];
    if (editing) {
      next = addresses.map(a => a.id === editing.id
        ? { ...a, label: addrLabel, line1: addrLine1, city: addrCity, postalCode: addrPostal }
        : a);
    } else {
      const id = String(Date.now());
      next = [...addresses, { id, label: addrLabel, line1: addrLine1, city: addrCity, postalCode: addrPostal }];
    }
    await persistAddresses(next);
    setAddrModalOpen(false);
  };

  const deleteAddress = async (id: string) => {
    Alert.alert('Adresi Sil', 'Bu adresi silmek istediğine emin misin?', [
      { text: 'Vazgeç' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          const next = addresses.filter(a => a.id !== id);
          await persistAddresses(next);
        }
      },
    ]);
  };

  // Kaydet
  const saveAll = async () => {
    const fn = titleCaseTR(firstName);
    const ln = titleCaseTR(lastName);
    const normEmail = normalizeEmail(email);
    const phoneDigits = onlyDigits(phone);

    if (!fn || !ln || !normEmail) {
      Alert.alert('Hata', 'Ad, Soyad ve E-posta zorunludur.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
      Alert.alert('Hata', 'Geçerli bir e-posta girin.');
      return;
    }
    if (phoneDigits && phoneDigits.length !== 11) {
      Alert.alert('Hata', 'Telefon 11 haneli olmalıdır.');
      return;
    }

    // e-posta değişimi için adresleri yeni key’e taşı
    const prevEmail = normalizeEmail(user.email);
    if (prevEmail && prevEmail !== normEmail) {
      try {
        const raw = await AsyncStorage.getItem(addrKey(prevEmail));
        if (raw) {
          await AsyncStorage.setItem(addrKey(normEmail), raw);
          await AsyncStorage.removeItem(addrKey(prevEmail));
        }
      } catch (e) {
        console.warn('migrate addresses error', e);
      }
    }

    // Profili güncelle
    applyUpdate({
      firstName: fn,
      lastName: ln,
      name: `${fn} ${ln}`.trim(),
      email: normEmail,
      phone: phoneDigits || '',
      address: addresses[0]
        ? `${addresses[0].label}: ${addresses[0].line1}, ${addresses[0].city}${addresses[0].postalCode ? ' ' + addresses[0].postalCode : ''}`
        : (user.address ?? ''),
    });

    Alert.alert('Kaydedildi', 'Bilgilerin güncellendi.', [
      { text: 'Tamam', onPress: () => navigation?.goBack?.() },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Kişisel Bilgiler</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Profil Kartı */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable style={styles.avatar} onPress={openAvatarMenu} android_ripple={{ color: '#e6e8ee' }}>
              {avatarUri
                ? <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                : <Text style={styles.avatarText}>{userInitials || 'U'}</Text>}
              {/* Kamera rozeti kaldırıldı */}
              {avatarUri && (
                <Pressable style={styles.removeBadge} onPress={removeAvatar} hitSlop={6}>
                  <Ionicons name="close" size={12} color="#fff" />
                </Pressable>
              )}
            </Pressable>

            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{titleCaseTR(firstName)} {titleCaseTR(lastName)}</Text>
              <Text style={styles.member}>Profil resmine dokunarak fotoğraf seç/kaldır</Text>
            </View>
          </View>
        </View>

        {/* Temel Bilgiler */}
        <Section title="Temel Bilgiler">
          <Field label="Ad">
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              onEndEditing={({ nativeEvent }) => setFirstName(titleCaseTR(nativeEvent.text))}
              placeholder="Ad"
              style={styles.input}
              autoCapitalize="words"
              autoCorrect
              returnKeyType="next"
              maxLength={50}
            />
          </Field>
          <Field label="Soyad">
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              onEndEditing={({ nativeEvent }) => setLastName(titleCaseTR(nativeEvent.text))}
              placeholder="Soyad"
              style={styles.input}
              autoCapitalize="words"
              autoCorrect
              returnKeyType="next"
              maxLength={50}
            />
          </Field>
        </Section>

        {/* İletişim */}
        <Section title="İletişim">
          <Field label="E-posta">
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="ornek@eposta.com"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
          </Field>
          <Field label="Telefon">
            <TextInput
              value={phone}
              onChangeText={(t)=>setPhone(onlyDigits(t).slice(0,11))}
              placeholder="05XXXXXXXXX"
              keyboardType="phone-pad"
              style={styles.input}
              maxLength={11}
            />
          </Field>
        </Section>

        {/* Adresler */}
        <Section
          title="Adreslerim"
          headerRight={
            <Pressable onPress={openAddAddress} style={styles.addBtn} android_ripple={{ color: '#e6e8ee' }}>
              <Ionicons name="add" size={18} color={COLORS.primary} />
              <Text style={styles.addBtnText}>Adres Ekle</Text>
            </Pressable>
          }
        >
          {addresses.map((addr, idx) => (
            <View key={addr.id} style={styles.addressCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.addrTitle}>
                  {addr.label}{idx === 0 ? ' • Ana' : ''}
                </Text>
                <Text style={styles.addrText}>{addr.line1}</Text>
                <Text style={styles.addrText}>
                  {addr.city}{addr.postalCode ? `, ${addr.postalCode}` : ''}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {/* Ana yap (liste başına al) */}
                {idx > 0 && (
                  <Pressable
                    onPress={async () => {
                      const copy = [...addresses];
                      const [item] = copy.splice(idx, 1);
                      copy.unshift(item);
                      await persistAddresses(copy);
                    }}
                    hitSlop={8}
                  >
                    <Ionicons name="star-outline" size={20} color={COLORS.primary} />
                  </Pressable>
                )}
                <Pressable onPress={() => openEditAddress(addr)} hitSlop={8}>
                  <Ionicons name="create-outline" size={20} color={COLORS.muted} />
                </Pressable>
                <Pressable onPress={() => deleteAddress(addr.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={20} color={COLORS.accent} />
                </Pressable>
              </View>
            </View>
          ))}
          {!addresses.length && <Text style={{ color: COLORS.muted, marginTop: 8 }}>Kayıtlı adres yok.</Text>}
        </Section>

        {/* Kaydet */}
        <Pressable onPress={saveAll} style={styles.primaryBtn} android_ripple={{ color: '#e6e8ee' }}>
          <Text style={styles.primaryBtnText}>Kaydet</Text>
        </Pressable>
      </ScrollView>

      {/* Adres Modal */}
      <Modal visible={addrModalOpen} animationType="slide" transparent onRequestClose={() => setAddrModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Adresi Düzenle' : 'Yeni Adres'}</Text>
              <Pressable onPress={() => setAddrModalOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </Pressable>
            </View>

            <View style={{ gap: 10 }}>
              <LabeledInput label="Etiket (Ev/İş vb.)" value={addrLabel} onChangeText={setAddrLabel} />
              <LabeledInput label="Adres Satırı" value={addrLine1} onChangeText={setAddrLine1} />
              <LabeledInput label="Şehir" value={addrCity} onChangeText={setAddrCity} />
              <LabeledInput label="Posta Kodu" value={addrPostal} onChangeText={(t)=>setAddrPostal(onlyDigits(t))} keyboardType="number-pad" />
            </View>

            <Pressable onPress={saveAddress} style={[styles.primaryBtn, { marginTop: 16 }]}>
              <Text style={styles.primaryBtnText}>{editing ? 'Güncelle' : 'Ekle'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------- yardımcı bileşenler ---------- */

function Section({ title, children, headerRight }: { title: string; children: React.ReactNode; headerRight?: React.ReactNode }) {
  return (
    <View style={{ marginTop: 16 }}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {headerRight}
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function LabeledInput(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...rest} style={[styles.input, style]} />
    </View>
  );
}

/* ---------- stiller ---------- */

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
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12, overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  // camBadge kaldırıldı
  removeBadge: {
    position: 'absolute',
    top: -4,
    left: -4,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    padding: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },

  name: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  member: { fontSize: 12, color: COLORS.muted, marginTop: 2 },

  sectionHeader: {
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },

  label: { marginBottom: 6, color: COLORS.muted, fontSize: 12 },
  input: {
    height: 44,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 12,
    backgroundColor: '#fff', color: COLORS.text,
  },

  addressCard: {
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginBottom: 10,
  },
  addrTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  addrText: { fontSize: 12, color: COLORS.muted },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: '#fff',
  },
  addBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },

  primaryBtn: {
    marginTop: 16,
    height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

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
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
});
