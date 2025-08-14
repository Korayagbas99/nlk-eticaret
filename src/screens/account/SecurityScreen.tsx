// src/screens/account/SecurityScreen.tsx
import React, { useMemo, useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Switch,
  Alert,
  Linking,
  Share,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS } from '../../theme';
import * as LocalAuthentication from 'expo-local-authentication';
import * as OTPAuth from 'otpauth';
import * as Crypto from 'expo-crypto';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { useUser } from '../../context/user';

type TwoFAMethod = 'Authenticator' | 'SMS';
type SessionDevice = { id: string; name: string; location: string; lastSeen: string; current?: boolean };

/* -------- şifre skoru -------- */
const passScore = (p: string) => {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-ZÇĞİÖŞÜ]/.test(p)) s++;
  if (/[a-zçğıöşü]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(s, 4);
};
const passLabel = ['Çok zayıf', 'Zayıf', 'Orta', 'İyi', 'Güçlü'];
const strengthColor = (s: number) => (s >= 4 ? '#16a34a' : s === 3 ? '#22c55e' : s === 2 ? '#eab308' : '#ef4444');

/* ---- Cihaz adı ---- */
const getCurrentDeviceName = (): string => {
  const dn = (Constants.deviceName as string | undefined)?.trim();
  if (dn) return dn;
  if (Platform.OS === 'android') return 'Android Telefon';
  if (Platform.OS === 'ios') return 'iOS Cihazı';
  return 'Bu cihaz';
};
const isPhoneLike = (name: string) => !/windows|macos|chrome|safari|edge|firefox/i.test(name);

export default function SecurityScreen({ navigation }: any) {
  const { user, update } = useUser();
  // update undefined olabilir → güvenli çağrı
  const safeUpdate = (patch: any) => { try { (update as any)?.(patch); } catch {} };

  const [twoFAEnabled, setTwoFAEnabled] = useState(!!user.twoFactorEnabled);
  const [biometricEnabled, setBiometricEnabled] = useState(!!user.biometricEnabled);
  useEffect(() => setTwoFAEnabled(!!user.twoFactorEnabled), [user.twoFactorEnabled]);
  useEffect(() => setBiometricEnabled(!!user.biometricEnabled), [user.biometricEnabled]);

  // 2FA modal state
  const [twoFAOpen, setTwoFAOpen] = useState(false);
  const [twoFAMethod, setTwoFAMethod] = useState<TwoFAMethod>('Authenticator');
  const [twoFACode, setTwoFACode] = useState('');
  const [setupSecret, setSetupSecret] = useState<OTPAuth.Secret | null>(null);
  const [setupUri, setSetupUri] = useState<string>('');

  // password modal
  const [pwOpen, setPwOpen] = useState(false);
  const [currPw, setCurrPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [repPw, setRepPw] = useState('');
  const [showCurr, setShowCurr] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showRep, setShowRep] = useState(false);

  const score = useMemo(() => passScore(newPw), [newPw]);

  // sessions
  const [devices, setDevices] = useState<SessionDevice[]>([]);
  useEffect(() => {
    const now = new Date().toLocaleString('tr-TR');
    const currentName = getCurrentDeviceName();
    setDevices([
      { id: 'this', name: currentName, location: 'İstanbul, TR', lastSeen: now, current: true },
      { id: 'd2', name: 'Chrome • Windows', location: 'İstanbul, TR', lastSeen: '13 Ağustos 2025 23:10' },
      { id: 'd3', name: 'Safari • macOS', location: 'Ankara, TR', lastSeen: '11 Ağustos 2025 08:22' },
    ]);
  }, []);

  /* ------------------ 2FA: TOTP kurulumu ------------------ */
  const start2FASetup = async () => {
    try {
      const bytes = await Crypto.getRandomBytesAsync(20);
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const secret = new OTPAuth.Secret({ buffer });

      const label = user.email || `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'nlk-eticaret';
      const totp = new OTPAuth.TOTP({
        issuer: 'nlk-eticaret',
        label,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret,
      });

      setSetupSecret(secret);
      setSetupUri(totp.toString());
      setTwoFAMethod('Authenticator');
      setTwoFACode('');
      setTwoFAOpen(true);
    } catch (e) {
      Alert.alert('Hata', 'Cihazda kriptografik rastgele sayı üretilemedi.');
      console.warn('2FA setup error:', e);
    }
  };

  const onToggle2FA = (val: boolean) => {
    if (val) {
      start2FASetup();
    } else {
      Alert.alert('2FA Kapatılsın mı?', 'İki aşamalı doğrulamayı devre dışı bırakmak üzeresin.', [
        { text: 'Vazgeç' },
        {
          text: 'Kapat',
          style: 'destructive',
          onPress: () => {
            setTwoFAEnabled(false);
            safeUpdate({ twoFactorEnabled: false, twoFactorType: undefined, twoFactorSecret: undefined });
          },
        },
      ]);
    }
  };

  const confirm2FA = () => {
    if (!setupSecret) return;
    if (twoFAMethod === 'Authenticator') {
      const totp = new OTPAuth.TOTP({
        issuer: 'nlk-eticaret',
        label: user.email || 'nlk-eticaret',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: setupSecret,
      });
      const validated = totp.validate({ token: twoFACode, window: 1 });
      if (validated === null) {
        Alert.alert('Kod yanlış', 'Girdiğin 6 haneli kod doğrulanamadı.');
        return;
      }
      setTwoFAEnabled(true);
      setTwoFAOpen(false);
      setTwoFACode('');
      safeUpdate({ twoFactorEnabled: true, twoFactorType: 'TOTP', twoFactorSecret: setupSecret.base32 });
      Alert.alert('2FA etkin', 'Authenticator ile iki aşamalı doğrulama aktifleştirildi.');
    } else {
      Alert.alert('SMS 2FA', 'SMS doğrulaması için sunucu entegrasyonu gereklidir.');
    }
  };

  /* -------- QR aynı cihazdaysa yardımcı aksiyonlar -------- */
  const copySecret = async () => {
    if (!setupSecret) return;
    await Clipboard.setStringAsync(setupSecret.base32);
    Alert.alert('Kopyalandı', 'Kurulum anahtarı panoya kopyalandı.');
  };

  const openInAuthenticator = async () => {
    if (!setupUri) return;
    const supported = await Linking.canOpenURL(setupUri);
    if (!supported) {
      Alert.alert(
        'Uygulama bulunamadı',
        'Bu cihazda otpauth bağlantısını açabilecek bir Authenticator yok. "Kurulum anahtarını gir" seçeneğini kullanabilirsin.'
      );
      return;
    }
    await Linking.openURL(setupUri);
  };

  const shareSetup = async () => {
    if (!setupUri) return;
    await Share.share({ message: setupUri });
  };

  /* ------------------ Biyometrik giriş ------------------ */
  const onToggleBiometric = async (val: boolean) => {
    if (!val) {
      setBiometricEnabled(false);
      safeUpdate({ biometricEnabled: false });
      return;
    }
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return Alert.alert('Destek yok', 'Bu cihazda biyometrik sensör bulunmuyor.');
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) return Alert.alert('Kayıt yok', 'Önce cihaz ayarlarından parmak izi/Face ID eklemelisin.');
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Biyometrik doğrulama',
      cancelLabel: 'İptal',
      disableDeviceFallback: false,
    });
    if (res.success) {
      setBiometricEnabled(true);
      safeUpdate({ biometricEnabled: true });
      Alert.alert('Hazır', 'Bundan sonra girişte biyometrik doğrulama isteyebiliriz.');
    } else {
      Alert.alert('Başarısız', 'Biyometrik doğrulama iptal/başarısız.');
    }
  };

  /* ------------------ Şifre akışı ------------------ */
  const openChangePassword = () => {
    setPwOpen(true);
    setCurrPw(''); setNewPw(''); setRepPw('');
    setShowCurr(false); setShowNew(false); setShowRep(false);
  };

  const savePassword = async () => {
    const cpw = (currPw || '').trim();
    const npw = (newPw || '').trim();
    const rpw = (repPw || '').trim();
    const sc = passScore(npw);

    if (!cpw) return Alert.alert('Eksik', 'Mevcut şifreyi girin.');
    if (npw.length < 8) return Alert.alert('Zayıf şifre', 'Yeni şifre en az 8 karakter olmalı.');
    if (sc < 2) return Alert.alert('Zayıf şifre', 'Daha güçlü bir şifre belirleyin.');
    if (npw !== rpw) return Alert.alert('Eşleşmiyor', 'Yeni şifre ve tekrarı aynı olmalı.');

    try {
      const emailFromCtx = (user?.email ?? '').toLowerCase().trim();
      const emailFromStorage = ((await AsyncStorage.getItem('@authEmail')) ?? '').toLowerCase().trim();
      const emailKey = emailFromCtx || emailFromStorage;

      const raw = await AsyncStorage.getItem('@users');
      const users: any[] = raw ? JSON.parse(raw) : [];

      const idxs: number[] = [];
      users.forEach((u, i) => { if (((u?.email ?? '').toLowerCase().trim()) === emailKey) idxs.push(i); });

      if (!emailKey || idxs.length === 0) return Alert.alert('Hata', 'Kullanıcı kaydı bulunamadı.');
      if (users[idxs[0]].password !== cpw) return Alert.alert('Hata', 'Mevcut şifre hatalı.');

      idxs.forEach(i => { users[i].password = npw; });
      await AsyncStorage.setItem('@users', JSON.stringify(users));

      await AsyncStorage.multiRemove(['@authEmail', '@currentUserEmail', '@userProfile', 'authToken', 'refreshToken']);

      setPwOpen(false);
      Alert.alert('Şifre güncellendi', 'Lütfen yeni şifrenizle tekrar giriş yapın.', [
        { text: 'Tamam', onPress: () => {
          try { navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] }); }
          catch { Updates.reloadAsync().catch(() => {}); }
        } },
      ]);
    } catch (err) {
      console.warn('savePassword error:', err);
      Alert.alert('Hata', 'Şifre güncellenirken bir sorun oluştu.');
    }
  };

  /* ------------------ Oturumlar ------------------ */
  const signOutLocally = async () => {
    try { await AsyncStorage.multiRemove(['authToken', 'refreshToken', '@authEmail', '@currentUserEmail', '@userProfile']); } catch {}
    try { navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] }); return; } catch {}
    try { await Updates.reloadAsync(); } catch {}
  };

  const signOutDevice = (id: string) => {
    const dev = devices.find(d => d.id === id);
    if (!dev) return;

    if (dev.current) {
      Alert.alert('Bu cihazdan çıkış', 'Bu cihazdaki oturum kapatılacak ve giriş ekranına döneceksin.', [
        { text: 'Vazgeç' },
        { text: 'Çıkış Yap', style: 'destructive', onPress: signOutLocally },
      ]);
    } else {
      setDevices(prev => prev.filter(d => d.id !== id));
      Alert.alert('Oturum kapatıldı', `${dev.name} oturumu sonlandırıldı.`);
    }
  };

  const signOutAll = () => {
    const hasCurrent = devices.some(d => d.current);
    Alert.alert('Tüm Oturumlar', hasCurrent ? 'Tüm cihazlardan çıkış yapılacak. Bu cihazda da oturum kapanacak.' : 'Tüm cihazlardaki oturumlardan çıkış yapılacak.', [
      { text: 'Vazgeç' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: async () => {
        setDevices(prev => prev.filter(d => d.current));
        if (hasCurrent) await signOutLocally();
      } },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Güvenlik</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Şifre */}
        <Section title="Şifre">
          <View style={{ gap: 8 }}>
            <Row icon="lock-closed-outline" label="Hesap şifreni düzenle" />
            <Pressable onPress={openChangePassword} style={styles.primaryBtn} android_ripple={{ color: '#e6e8ee' }}>
              <Text style={styles.primaryBtnText}>Şifreyi Değiştir</Text>
            </Pressable>
          </View>
        </Section>

        {/* Güvenlik Ayarları */}
        <Section title="Güvenlik Ayarları">
          <ItemToggle
            icon="shield-checkmark-outline"
            title="İki Aşamalı Doğrulama (Authenticator)"
            subtitle={twoFAEnabled ? 'Etkin' : 'Kapalı'}
            value={twoFAEnabled}
            onValueChange={onToggle2FA}
          />
          <ItemToggle
            icon="finger-print-outline"
            title="Biyometrik Giriş"
            subtitle={biometricEnabled ? 'Etkin' : 'Kapalı'}
            value={biometricEnabled}
            onValueChange={onToggleBiometric}
          />
        </Section>

        {/* Oturumlar */}
        <Section
          title="Aktif Oturumlar"
          headerRight={
            <Pressable onPress={signOutAll} style={styles.lightBtn} android_ripple={{ color: '#e6e8ee' }}>
              <Ionicons name="log-out-outline" size={16} color={COLORS.primary} />
              <Text style={styles.lightBtnText}>Tüm Oturumlardan Çıkış</Text>
            </Pressable>
          }
        >
          {devices.map(d => (
            <View key={d.id} style={styles.deviceRow}>
              <View style={styles.deviceIcon}>
                <Ionicons name={isPhoneLike(d.name) ? 'phone-portrait-outline' : 'laptop-outline'} size={16} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deviceName}>{d.name} {d.current ? '• Bu cihaz' : ''}</Text>
                <Text style={styles.deviceSub}>{d.location} • Son görülme: {d.lastSeen}</Text>
              </View>
              <Pressable onPress={() => signOutDevice(d.id)} hitSlop={8}>
                <Ionicons name="close-circle-outline" size={22} color={COLORS.accent} />
              </Pressable>
            </View>
          ))}
          {!devices.length && <Text style={{ color: COLORS.muted }}>Aktif oturum bulunmuyor.</Text>}
        </Section>
      </ScrollView>

      {/* 2FA Modal */}
      <Modal visible={twoFAOpen} transparent animationType="slide" onRequestClose={() => setTwoFAOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>2FA Kurulumu</Text>
              <Pressable onPress={() => setTwoFAOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </Pressable>
            </View>

            <Text style={{ color: COLORS.muted, marginBottom: 8 }}>
              Authenticator uygulaması (Google Authenticator, 1Password, Authy vb.) ile QR kodu tara.
            </Text>

            {!!setupUri && (
              <>
                <View style={{ alignItems: 'center', marginBottom: 12 }}>
                  <QRCode value={setupUri} size={160} />
                  {setupSecret && (
                    <Text style={{ color: COLORS.muted, marginTop: 8, fontSize: 12 }}>
                      Yedek kod: {setupSecret.base32}
                    </Text>
                  )}
                </View>

                <View style={styles.actionsRow}>
                  <Pressable onPress={copySecret} style={styles.lightBtn} android_ripple={{ color: '#e6e8ee' }}>
                    <Ionicons name="copy-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.lightBtnText}>Kodu kopyala</Text>
                  </Pressable>
                  <Pressable onPress={openInAuthenticator} style={styles.lightBtn} android_ripple={{ color: '#e6e8ee' }}>
                    <Ionicons name="open-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.lightBtnText}>Authenticator’da aç</Text>
                  </Pressable>
                  <Pressable onPress={shareSetup} style={styles.lightBtn} android_ripple={{ color: '#e6e8ee' }}>
                    <Ionicons name="share-social-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.lightBtnText}>Paylaş</Text>
                  </Pressable>
                </View>
              </>
            )}

            <Text style={styles.label}>Uygulamadaki 6 haneli kod</Text>
            <TextInput
              value={twoFACode}
              onChangeText={(t) => setTwoFACode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="______"
              style={styles.input}
              maxLength={6}
            />

            <Pressable onPress={confirm2FA} style={[styles.primaryBtn, { marginTop: 12 }]} android_ripple={{ color: '#e6e8ee' }}>
              <Text style={styles.primaryBtnText}>Etkinleştir</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Şifre Değiştir Modal */}
      <Modal visible={pwOpen} transparent animationType="slide" onRequestClose={() => setPwOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Şifre Değiştir</Text>
              <Pressable onPress={() => setPwOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </Pressable>
            </View>

            <Label>Mevcut Şifre</Label>
            <PasswordInput value={currPw} onChangeText={setCurrPw} visible={showCurr} onToggle={() => setShowCurr(v => !v)} />

            <Label>Yeni Şifre</Label>
            <PasswordInput value={newPw} onChangeText={setNewPw} visible={showNew} onToggle={() => setShowNew(v => !v)} />

            <View style={styles.meterWrap}>
              {[0,1,2,3].map(i => (
                <View key={i} style={[styles.meterBar, i <= score-1 ? { backgroundColor: strengthColor(score) } : null]} />
              ))}
              <Text style={styles.meterText}>{passLabel[score]}</Text>
            </View>

            <Label>Yeni Şifre (Tekrar)</Label>
            <PasswordInput value={repPw} onChangeText={setRepPw} visible={showRep} onToggle={() => setShowRep(v => !v)} />

            <Pressable onPress={savePassword} style={[styles.primaryBtn, { marginTop: 16 }]} android_ripple={{ color: '#e6e8ee' }}>
              <Text style={styles.primaryBtnText}>Kaydet</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------- küçük bileşenler ---------- */
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
function Row({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Ionicons name={icon} size={16} color={COLORS.muted} />
      <Text style={{ color: COLORS.text }}>{label}</Text>
    </View>
  );
}
function ItemToggle({
  icon, title, subtitle, value, onValueChange,
}: { icon: any; title: string; subtitle?: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemIcon}>
        <Ionicons name={icon} size={16} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.itemSub}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#d1d5db', true: COLORS.primary }}
        thumbColor="#fff"
        ios_backgroundColor="#d1d5db"
      />
    </View>
  );
}
const Label = ({ children }: { children: React.ReactNode }) => <Text style={styles.label}>{children}</Text>;
function PasswordInput({
  value, onChangeText, visible, onToggle,
}: { value: string; onChangeText: (t: string) => void; visible: boolean; onToggle: () => void }) {
  return (
    <View style={styles.inputWrap}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        placeholder="••••••••"
        style={[styles.input, { paddingRight: 40 }]}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType={Platform.OS === 'ios' ? ('oneTimeCode' as any) : 'password'}
        autoComplete="off"
        importantForAutofill="noExcludeDescendants"
      />
      <Pressable onPress={onToggle} hitSlop={8} style={styles.eyeBtn}>
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.muted} />
      </Pressable>
    </View>
  );
}

/* ---------- stiller ---------- */
const styles = StyleSheet.create({
  header: {
    height: 52, backgroundColor: COLORS.bg, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },

  sectionHeader: {
    paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },

  card: {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },

  primaryBtn: {
    height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  lightBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: '#fff',
  },
  lightBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },

  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  itemIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  itemTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  itemSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },

  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  deviceIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f2a44' },
  deviceName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  deviceSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(16,24,40,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOpacity: 0.1,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  label: { marginBottom: 6, color: COLORS.muted, fontSize: 12 },
  input: {
    height: 44, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#fff', color: COLORS.text,
  },
  inputWrap: { position: 'relative' },
  eyeBtn: { position: 'absolute', right: 10, top: 10 },

  meterWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 8 },
  meterBar: { flex: 1, height: 6, borderRadius: 4, backgroundColor: '#e5e7eb' },
  meterText: { color: COLORS.muted, fontSize: 12 },
});
