// src/components/StarRating.tsx
import React from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

type Props = {
  /** 0..5 (ondalıklı ortalama destekli) */
  value: number;
  /** etkileşimli yapmak için verin */
  onChange?: (next: number) => void;
  size?: number;
  showCount?: number; // örn. 12 → "(12)"
};

export default function StarRating({ value, onChange, size = 18, showCount }: Props) {
  const full = Math.floor(value);
  const frac = value - full;

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((i) => {
        const icon =
          i <= full ? 'star' :
          i === full + 1 && frac >= 0.5 ? 'star-half' : 'star-outline';

        const El = (
          <Ionicons
            key={i}
            name={icon as any}
            size={size}
            color="#F59E0B"
            style={{ marginRight: 2 }}
          />
        );

        if (!onChange) return El;
        return (
          <Pressable
            key={i}
            hitSlop={8}
            onPress={() => onChange(i)}
            onLongPress={() => onChange(0)} // uzun basınca kaldır
          >
            {El}
          </Pressable>
        );
      })}
      {typeof showCount === 'number' && (
        <Text style={styles.countText}>({showCount})</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  countText: { marginLeft: 6, fontSize: 12, color: '#6b7280' },
});
