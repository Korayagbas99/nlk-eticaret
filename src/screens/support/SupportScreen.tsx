import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS } from '../../theme';

type Props = { route?: { params?: { packId?: string; packTitle?: string } } };

const SUPPORT_PHONE = '+905555555555';         // kendi numaran
const SUPPORT_EMAIL = 'destek@seninsite.com';  // kendi mailin

export default function SupportScreen({ route }: Props) {
  const packTitle = route?.params?.packTitle;
  const message = packTitle
    ? `Merhaba, "${packTitle}" paketi hakkında bilgi ve ücretsiz demo talep etmek istiyorum.`
    : 'Merhaba, destek talebi oluşturmak istiyorum.';

  const callUs = async () => {
    const url = `tel:${SUPPORT_PHONE}`;
    try { await Linking.openURL(url); }
    catch { Alert.alert('Arama', 'Cihaz arama başlatmayı desteklemiyor.'); }
  };

  const whatsappUs = async () => {
    const phone = SUPPORT_PHONE.replace(/[^\d+]/g, '');
    const text = encodeURIComponent(message);
    const waUrl = `whatsapp://send?phone=${phone}&text=${text}`;
    const waWebFallback = `https://wa.me/${phone.replace('+', '')}?text=${text}`;
    try { await Linking.openURL(waUrl); } catch { await Linking.openURL(waWebFallback); }
  };

  const emailUs = async () => {
    const subject = encodeURIComponent('Destek Talebi');
    const body = encodeURIComponent(message);
    try { await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`); }
    catch { Alert.alert('E-posta', `Lütfen şu adrese yazın:\n${SUPPORT_EMAIL}`); }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Destek</Text>
      {!!packTitle && <Text style={styles.note}>Seçilen paket: <Text style={{fontWeight:'800'}}>{packTitle}</Text></Text>}

      <View style={{gap:12, marginTop:16}}>
        <Btn icon="call-outline" text="Telefonla Ara" onPress={callUs} />
        <Btn icon="logo-whatsapp" text="WhatsApp Yaz" onPress={whatsappUs} />
        <Btn icon="mail-outline" text="E-posta Gönder" onPress={emailUs} />
      </View>
    </View>
  );
}

function Btn({ icon, text, onPress }: { icon: any; text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} android_ripple={{ color: '#e6e8ee' }} style={styles.btn}>
      <Ionicons name={icon} size={18} color="#fff" />
      <Text style={styles.btnText}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  note: { marginTop: 6, color: COLORS.muted },
  btn: {
    height: 48, borderRadius: 12, backgroundColor: COLORS.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
