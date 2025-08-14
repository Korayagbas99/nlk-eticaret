import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { FavoriteProduct } from "../context/favorites";
import { useFavorites } from "../context/favorites";

type Props = {
  product: FavoriteProduct;
  onPress?: () => void;         // Detaya gitmek istersen
};

export default function ProductCard({ product, onPress }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(product.id);

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
      <View style={styles.card}>
        {/* Basit görsel placeholder’ı */}
        <View style={styles.thumb}>
          <Text style={styles.thumbText}>{product.title?.slice(0,1)?.toUpperCase()}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{product.title}</Text>
          <Text style={styles.price}>₺{product.priceMonthly.toLocaleString("tr-TR")}/ay</Text>
        </View>

        <TouchableOpacity onPress={() => toggleFavorite(product)} hitSlop={{top:8,bottom:8,left:8,right:8}}>
          <MaterialIcons name={fav ? "favorite" : "favorite-border"} size={22} color="#1D2B5B" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
  },
  thumb: {
    width: 52, height: 52, borderRadius: 10,
    backgroundColor: "#E9EEF8",
    alignItems: "center", justifyContent: "center",
  },
  thumbText: { fontSize: 18, fontWeight: "700", color: "#1D2B5B" },
  title: { fontSize: 16, fontWeight: "600", color: "#1D2B5B" },
  price: { fontSize: 13, color: "#666", marginTop: 2 },
});
