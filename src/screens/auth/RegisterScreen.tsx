import React, { useMemo, useState } from 'react';
import {
  View, TextInput, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, Dimensions, Alert, KeyboardAvoidingView, Platform, SafeAreaView
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RegisterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;
type Props = { navigation: RegisterScreenNavigationProp };

const { width, height } = Dimensions.get('window');
const logoHeight = height * 0.12;

/* ------------ yardımcılar ------------ */
const onlyDigits = (s: string) => s.replace(/\D+/g, '');
const normalizeSpaces = (s: string) => s.replace(/\s+/g, ' ').trim();

// Şifre gücü barı
const passScore = (p: string) => {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-ZÇĞİÖŞÜ]/.test(p)) s++;
  if (/[a-zçğıöşü]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(s, 4);
};
const passLabel = ['Çok zayıf', 'Zayıf', 'Orta', 'İyi', 'Güçlü'] as const;
const strengthColor = (s: number) =>
  s >= 4 ? '#16a34a' : s === 3 ? '#22c55e' : s === 2 ? '#eab308' : '#ef4444';

export default function RegisterScreen({ navigation }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [password2, setPassword2] = useState('');
  const [phone,     setPhone]     = useState('');
  const [address,   setAddress]   = useState('');

  const score = useMemo(() => passScore(password), [password]);

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !password2) {
      Alert.alert('Hata', 'Ad, Soyad, E-posta, Şifre ve Şifre (Tekrar) zorunludur.');
      return;
    }
    if (firstName.length > 25 || lastName.length > 25) {
      Alert.alert('Hata', 'Ad ve Soyad en fazla 25 karakter olabilir.');
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.com$/i.test(normalizedEmail)) {
      Alert.alert('Hata', 'E-posta geçersiz. "@" içermeli ve ".com" ile bitmelidir.');
      return;
    }

    const phoneDigits = onlyDigits(phone);
    if (phoneDigits.length !== 11) {
      Alert.alert('Hata', 'Telefon numarası 11 haneli olmalıdır.');
      return;
    }

    if (password !== password2) {
      Alert.alert('Hata', 'Şifreler uyuşmuyor.');
      return;
    }
    if (password.length < 8 || score < 2) {
      Alert.alert('Hata', 'Şifre zayıf. En az 8 karakter ve daha güçlü bir şifre belirleyin.');
      return;
    }

    try {
      const jsonValue = await AsyncStorage.getItem('@users');
      const users = jsonValue ? JSON.parse(jsonValue) : [];

      if (users.some((u: any) => (u.email ?? '').toLowerCase().trim() === normalizedEmail)) {
        Alert.alert('Hata', 'Bu e-posta zaten kayıtlı.');
        return;
      }

      const nowIso = new Date().toISOString();
      const newUser = {
        // Hem eski kodlarla uyum için "name", hem de ayrı alanlar:
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        email: normalizedEmail,
        password,
        phone: phoneDigits,
        address: normalizeSpaces(address),
        createdAt: nowIso,
      };

      await AsyncStorage.setItem('@users', JSON.stringify([...users, newUser]));

      Alert.alert('Başarılı', 'Kayıt tamamlandı!', [
        { text: 'Tamam', onPress: () => navigation.replace('Login') }
      ]);
    } catch (error) {
      console.error('Kayıt hatası:', error);
      Alert.alert('Hata', 'Kayıt sırasında bir hata oluştu.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={20}
      >
        <ScrollView contentContainerStyle={{ padding: 20, justifyContent: 'center' }}>
          <View style={{ height: logoHeight + 20, justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
            <Image
              source={require('../../../assets/nlk.png')}
              style={{ width: width * 0.35, height: logoHeight, resizeMode: 'contain' }}
            />
          </View>

          <TextInput
            placeholder="Ad"
            style={styles.input}
            value={firstName}
            onChangeText={(t) => setFirstName(t.slice(0, 25))}
            autoCapitalize="words"
            maxLength={25}
          />
          <TextInput
            placeholder="Soyad"
            style={styles.input}
            value={lastName}
            onChangeText={(t) => setLastName(t.slice(0, 25))}
            autoCapitalize="words"
            maxLength={25}
          />

          <TextInput
            placeholder="E-posta (ör. ad@alan.com)"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            placeholder="Şifre"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <View style={styles.meterWrap}>
            {[0,1,2,3].map(i => (
              <View key={i} style={[styles.meterBar, i <= score-1 ? { backgroundColor: strengthColor(score) } : null]} />
            ))}
            <Text style={styles.meterText}>{passLabel[score]}</Text>
          </View>
          <TextInput
            placeholder="Şifre (Tekrar)"
            style={styles.input}
            value={password2}
            onChangeText={setPassword2}
            secureTextEntry
          />

          <TextInput
            placeholder="Telefon (11 hane)"
            style={styles.input}
            value={phone}
            onChangeText={(t) => setPhone(onlyDigits(t).slice(0, 11))}
            keyboardType="phone-pad"
            maxLength={11}
          />

          <TextInput
            placeholder="Adres"
            style={[styles.input, { minHeight: 120 }]}
            value={address}
            onChangeText={(t) => setAddress(t)}
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity style={styles.button} onPress={handleRegister}>
            <Text style={styles.buttonText}>Kayıt Ol</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10 }}>
            <Text>Zaten hesabınız var mı? </Text>
            <TouchableOpacity onPress={() => navigation.replace('Login')}>
              <Text style={{ color: '#1D2B5B', fontWeight: 'bold' }}>Giriş Yap</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    padding: 10, marginBottom: 15, fontSize: 16, backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#1D2B5B', padding: 15, borderRadius: 8,
    alignItems: 'center', marginBottom: 10
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  meterWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4, marginBottom: 10 },
  meterBar: { flex: 1, height: 6, borderRadius: 4, backgroundColor: '#e5e7eb' },
  meterText: { color: '#667085', fontSize: 12 },
});
