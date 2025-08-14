// src/components/SafeImageView.tsx
import React from 'react';
import { Modal, View, Image, Pressable, StyleSheet, Dimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS } from '../theme';

type Img = { uri: string };
type Props = {
  images: Img[];
  visible: boolean;
  imageIndex?: number;
  onRequestClose: () => void;
};

let LibImageView: any = null;
try {
  // Paket sağlamsa buradan çalışır
  LibImageView = require('react-native-image-viewing').default;
} catch (e) {
  LibImageView = null;
}

export default function SafeImageView(props: Props) {
  if (LibImageView) return <LibImageView {...props} />;
  // --- Basit fallback Modal ---
  const idx = Math.max(0, Math.min((props.imageIndex ?? 0), (props.images?.length ?? 1) - 1));
  const uri = props.images?.[idx]?.uri;

  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onRequestClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.closeBtn} onPress={props.onRequestClose} hitSlop={10}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
        {uri ? <Image source={{ uri }} style={styles.img} resizeMode="contain" /> : null}
      </View>
    </Modal>
  );
}

const { width, height } = Dimensions.get('window');
const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute', top: 24, right: 16,
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  img: { width: width * 0.95, height: height * 0.8 },
});
