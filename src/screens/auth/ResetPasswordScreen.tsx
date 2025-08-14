// src/screens/auth/ResetPasswordScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ResetPasswordScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ResetPassword'
>;
type Props = { navigation: ResetPasswordScreenNavigationProp };

const { width, height } = Dimensions.get('window');
const logoHeight = height * 0.15;

type User = {
  name?: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
};

/* --- Güvenlik ekranıyla uyumlu basit şifre skoru --- */
const passScore = (p: string) => {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-ZÇĞİÖŞÜ]/.test(p)) s++;
  if (/[a-zçğıöşü]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(s, 4); // 0..4
};
const passLabel = ['Çok zayıf', 'Zayıf', 'Orta', 'İyi', 'Güçlü'];
const strengthColor = (s: number) =>
  s >= 4 ? '#16a34a' : s === 3 ? '#22c55e' : s === 2 ? '#eab308' : '#ef4444';

const ResetPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [visNew, setVisNew] = useState(false);
  const [visRep, setVisRep] = useState(false);

  const score = useMemo(() => passScore(newPassword), [newPassword]);

  const handleResetPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !newPassword || !confirmPassword) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun.');
      return;
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    if (!emailOk) {
      Alert.alert('Hata', 'Geçerli bir e-posta adresi girin.');
      return;
    }

    if (newPassword.length < 8 || score < 2) {
      Alert.alert('Zayıf şifre', 'Yeni şifre en az 8 karakter ve daha güçlü olmalı.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Hata', 'Şifreler uyuşmuyor!');
      return;
    }

    try {
      const jsonValue = await AsyncStorage.getItem('@users');
      const storedUsers: User[] = jsonValue ? JSON.parse(jsonValue) : [];

      // Aynı e-postaya sahip TÜM kayıtları güncelle (duplikeler için)
      const indices: number[] = [];
      storedUsers.forEach((u, i) => {
        if ((u.email ?? '').toLowerCase().trim() === normalizedEmail) indices.push(i);
      });

      if (indices.length === 0) {
        Alert.alert('Hata', 'Bu e-posta kayıtlı değil.');
        return;
      }

      indices.forEach((i) => {
        storedUsers[i].password = newPassword;
      });

      await AsyncStorage.setItem('@users', JSON.stringify(storedUsers));

      // Oturum işaretlerini temizle → yeni şifre ile yeniden giriş iste
      await AsyncStorage.multiRemove([
        '@authEmail',
        '@currentUserEmail',
        '@userProfile',
        'authToken',
        'refreshToken',
      ]);

      Alert.alert('Başarılı', 'Şifreniz sıfırlandı. Lütfen yeni şifrenizle giriş yapın.', [
        { text: 'Tamam', onPress: () => navigation.replace('Login', undefined) },
      ]);
    } catch (e) {
      console.error('Şifre sıfırlama hatası:', e);
      Alert.alert('Hata', 'Bir hata oluştu.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.logoContainer}>
            <Image
              source={require('../../../assets/nlk.png')}
              style={{ width: width * 0.4, height: logoHeight, resizeMode: 'contain' }}
            />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Kayıtlı E-posta"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            autoComplete="email"
            returnKeyType="next"
          />

          {/* Yeni şifre */}
          <View style={{ position: 'relative' }}>
            <TextInput
              style={[styles.input, { paddingRight: 44 }]}
              placeholder="Yeni Şifre"
              secureTextEntry={!visNew}
              value={newPassword}
              onChangeText={setNewPassword}
              // iOS AutoFill eski şifreyi enjekte etmesin:
              textContentType={Platform.OS === 'ios' ? ('oneTimeCode' as any) : 'newPassword'}
              autoComplete="off"
              importantForAutofill="noExcludeDescendants"
              autoCorrect={false}
              returnKeyType="next"
            />
            <TouchableOpacity onPress={() => setVisNew((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
              <Ionicons name={visNew ? 'eye-off-outline' : 'eye-outline'} size={20} color="#667085" />
            </TouchableOpacity>
          </View>

          {/* Güç göstergesi */}
          <View style={styles.meterWrap}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[styles.meterBar, i <= score - 1 ? { backgroundColor: strengthColor(score) } : null]}
              />
            ))}
            <Text style={styles.meterText}>{passLabel[score]}</Text>
          </View>

          {/* Yeni şifre tekrar */}
          <View style={{ position: 'relative' }}>
            <TextInput
              style={[styles.input, { paddingRight: 44 }]}
              placeholder="Yeni Şifre (Tekrar)"
              secureTextEntry={!visRep}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              textContentType={Platform.OS === 'ios' ? ('oneTimeCode' as any) : 'newPassword'}
              autoComplete="off"
              importantForAutofill="noExcludeDescendants"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleResetPassword}
            />
            <TouchableOpacity onPress={() => setVisRep((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
              <Ionicons name={visRep ? 'eye-off-outline' : 'eye-outline'} size={20} color="#667085" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleResetPassword}>
            <Text style={styles.buttonText}>Şifreyi Sıfırla</Text>
          </TouchableOpacity>

          <View style={styles.row}>
            <Text>Zaten hesabınız var mı? </Text>
            <TouchableOpacity onPress={() => navigation.replace('Login', undefined)}>
              <Text style={{ color: '#1D2B5B', fontWeight: 'bold' }}>Giriş Yap</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ResetPasswordScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  logoContainer: {
    height: logoHeight + 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#1D2B5B',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  meterWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -6, marginBottom: 10 },
  meterBar: { flex: 1, height: 6, borderRadius: 4, backgroundColor: '#e5e7eb' },
  meterText: { color: '#667085', fontSize: 12 },
  eyeBtn: { position: 'absolute', right: 12, top: 12 },
});
