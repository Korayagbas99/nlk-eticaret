import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { COLORS } from '../../theme';
import RequireRole from '../auth/RequireRole';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function PanelAddScreen() {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [desc, setDesc] = useState('');

  const onSubmit = async () => {
    if (!name.trim()) return Alert.alert('Zorunlu Alan', 'Panel adı zorunludur.');
    Alert.alert('Başarılı', 'Panel oluşturuldu.');
    setName(''); setUrl(''); setDesc('');
  };

  return (
    <RequireRole requiredRole="admin" requiredPerm="panel:create">
      <ScrollView style={styles.safe} contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>Panel Ekle</Text>

        <View style={styles.group}>
          <Text style={styles.label}>Panel Adı *</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Örn: Yönetim Paneli" placeholderTextColor={COLORS.muted} style={styles.input} />
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>Panel URL</Text>
          <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" placeholder="https://panel.ornek.com" placeholderTextColor={COLORS.muted} style={styles.input} />
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>Açıklama</Text>
          <TextInput value={desc} onChangeText={setDesc} placeholder="Kısa açıklama" placeholderTextColor={COLORS.muted} style={[styles.input, { height: 96, textAlignVertical: 'top' }]} multiline />
        </View>

        <Pressable style={styles.saveBtn} onPress={onSubmit} android_ripple={{ color: '#e6e8ee' }}>
          <Ionicons name="save-outline" size={16} color="#fff" />
          <Text style={styles.saveText}>Kaydet</Text>
        </Pressable>
      </ScrollView>
    </RequireRole>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  group: { marginBottom: 12 },
  label: { color: COLORS.muted, fontSize: 12, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text },
  saveBtn: { marginTop: 10, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.primary },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
