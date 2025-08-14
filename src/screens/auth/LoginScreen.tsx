// src/screens/auth/LoginScreen.tsx
import React, { useState } from 'react';
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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../../context/user';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;
type Props = { navigation: LoginScreenNavigationProp };

const { width, height } = Dimensions.get('window');
const logoHeight = height * 0.12;

// Sadece bu hesapla girişte admin yap
const DEMO_ADMIN = { email: 'okan@gmail.com', password: '12345678' };

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // setUser YOK; context’ten sadece hydrateFromStorage alıyoruz
  const { hydrateFromStorage } = useUser();

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const typedPassword = password;

    if (!normalizedEmail || !typedPassword) {
      Alert.alert('Hata', 'E-posta ve şifre zorunludur.');
      return;
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    if (!emailOk) {
      Alert.alert('Hata', 'Geçerli bir e-posta adresi girin.');
      return;
    }

    try {
      const raw = await AsyncStorage.getItem('@users');
      const users: any[] = raw ? JSON.parse(raw) : [];

      const u = users.find(
        (x: any) =>
          (x.email ?? '').toLowerCase().trim() === normalizedEmail &&
          x.password === typedPassword
      );

      if (!u) {
        Alert.alert('Hata', 'E-posta veya şifre yanlış.');
        return;
      }

      const isDemoAdmin =
        normalizedEmail === DEMO_ADMIN.email && typedPassword === DEMO_ADMIN.password;

      // Profil objesi (AccountScreen ve UserContext bunu kullanır)
      const profile = {
        id: u.id ?? normalizedEmail,
        name: u.name ?? u.firstName ?? 'Kullanıcı',
        email: normalizedEmail,
        role: isDemoAdmin ? 'admin' : (u.role ?? 'user'),
        permissions: isDemoAdmin
          ? Array.from(new Set([...(u.permissions ?? []), 'product:create', 'panel:create']))
          : (u.permissions ?? []),
        memberSince: u.memberSince ?? u.createdAt ?? new Date().toISOString().slice(0, 10),
        avatarUri: u.avatarUri,
        stats: u.stats ?? { orders: 0, packages: 0, spend: 0 },
      };

      // 1) Auth işaretleri
      await AsyncStorage.setItem('@authEmail', normalizedEmail);
      await AsyncStorage.setItem('@currentUserEmail', normalizedEmail);

      // 2) Profil’i kaydet
      await AsyncStorage.setItem('@userProfile', JSON.stringify(profile));

      // 3) Context’i storage’dan güncelle (setUser kullanmadan)
      await hydrateFromStorage();

      // 4) Uygulamaya geç
      navigation.replace('Tabs', { screen: 'Anasayfa' }); // ← TS tipleri 2 arg bekliyor
    } catch (e) {
      console.warn('Login error:', e);
      Alert.alert('Hata', 'Giriş yapılırken bir sorun oluştu.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              height: logoHeight + 20,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <Image
              source={require('../../../assets/nlk.png')}
              style={{ width: width * 0.35, height: logoHeight, resizeMode: 'contain' }}
            />
          </View>

          <TextInput
            placeholder="E-posta"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            autoComplete="email"
            returnKeyType="next"
          />

          <TextInput
            placeholder="Şifre"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            // iOS’te eski şifre AutoFill ile geri yazılmasın:
            textContentType={Platform.OS === 'ios' ? ('oneTimeCode' as any) : 'password'}
            autoComplete="off"
            importantForAutofill="noExcludeDescendants"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />

          {/* Şifremi Unuttum → sağda */}
          <View style={styles.inlineRight}>
            <TouchableOpacity onPress={() => navigation.replace('ResetPassword', undefined)}>
              <Text style={styles.linkText}>Şifremi Unuttum</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Giriş Yap</Text>
          </TouchableOpacity>

          {/* Hesabınız yok mu? Kayıt Ol */}
          <View style={styles.registerRow}>
            <Text style={styles.helperText}>Hesabınız yok mu? </Text>
            <TouchableOpacity onPress={() => navigation.replace('Register', undefined)}>
              <Text style={styles.linkText}>Kayıt Ol</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  inlineRight: {
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    marginBottom: 15,
  },
  linkText: {
    color: '#1D2B5B',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#1D2B5B',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
  },
  helperText: { color: '#333' },
});
