// src/screens/FavoritesScreen.tsx
import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import ProductCard from '../components/productcard';
import { useFavorites } from '../context/favorites';

type FavItem = {
  id: string;
  title: string;
  priceMonthly?: number;   // context'te opsiyonel gelebilir
  addedDate?: string;
  thumbnail?: string;      // ProductCard tipinde bu alan yok -> product prop'una göndermeyeceğiz
};

export default function FavoritesScreen() {
  const navigation = useNavigation<any>();
  const { favorites, favoritesCount, totalMonthlyValue } = useFavorites();

  const list = useMemo<FavItem[]>(
    () => (Array.isArray(favorites) ? (favorites as FavItem[]) : []),
    [favorites]
  );

  const goBack = () => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.getParent?.()?.navigate?.('Anasayfa');
  };

  const goDetail = (id?: string) => {
    if (!id) return;
    const parent = navigation.getParent?.();
    if (parent && parent.navigate) {
      parent.navigate('PackageDetail' as never, { id } as never);
    } else {
      navigation.navigate('PackageDetail' as never, { id } as never);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Başlık ve Geri Butonu */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}>
          <MaterialIcons name="arrow-back" size={24} color="#1D2B5B" />
        </TouchableOpacity>
        <Text style={styles.title}>Favoriler</Text>
        <View style={{ width: 24 }} />
      </View>

      {favoritesCount === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Favori ürününüz bulunmamaktadır</Text>
        </View>
      ) : (
        <>
          {/* Özet */}
          <View style={styles.summaryContainer}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{favoritesCount}</Text>
              <Text style={styles.summaryLabel}>Favori Paket</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>
                ₺{Number(totalMonthlyValue || 0).toLocaleString('tr-TR')}
              </Text>
              <Text style={styles.summaryLabel}>Toplam Aylık Değer</Text>
            </View>

            <MaterialIcons name="favorite" size={24} color="#1D2B5B" style={styles.heartIcon} />
          </View>

          {/* Liste başlığı */}
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderText}>{favoritesCount} favori paket</Text>
            <Text style={styles.sortText}>En Yeni</Text>
          </View>

          {/* Liste */}
          <FlatList
            data={list}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.productContainer}>
                <ProductCard
                  product={{
                    id: String(item.id),
                    title: item.title,
                    // ✅ FavoriteProduct.priceMonthly: number zorunlu → normalize
                    priceMonthly: Number(item.priceMonthly ?? 0),
                    // ❌ thumbnail ProductCard tipinde yok — göndermiyoruz
                    addedDate: item.addedDate, // bu alan ProductCard tipinde varsa gösterilir, yoksa yoksayılır
                  }}
                  onPress={() => goDetail(item.id)}
                />

                <View style={styles.productMeta}>
                  <Text style={styles.addedDate}>
                    Favorilere eklendi: {item.addedDate || '—'}
                  </Text>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.detailButton}
                      onPress={() => goDetail(item.id)}
                    >
                      <Text style={[styles.buttonText, { color: '#1D2B5B' }]}>Detayları Gör</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.buyButton}
                      onPress={() => goDetail(item.id)}
                    >
                      <Text style={styles.buttonText}>Satın Al</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1D2B5B' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  emptyText: { fontSize: 16, color: '#666' },

  summaryContainer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryNumber: { fontSize: 24, fontWeight: 'bold', color: '#1D2B5B' },
  summaryLabel: { fontSize: 14, color: '#666', marginTop: 4 },
  heartIcon: { marginLeft: 16 },

  listHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  listHeaderText: { fontSize: 16, fontWeight: '600', color: '#1D2B5B' },
  sortText: { fontSize: 14, color: '#666' },

  productContainer: {
    marginHorizontal: 16, marginVertical: 8,
    borderWidth: 1, borderColor: '#eee', borderRadius: 10, overflow: 'hidden',
  },
  productMeta: { padding: 12, borderTopWidth: 1, borderTopColor: '#eee' },
  addedDate: { fontSize: 12, color: '#666', marginBottom: 8 },

  actionButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  detailButton: {
    backgroundColor: '#fff', paddingVertical: 12, borderRadius: 8, flex: 1, marginRight: 8,
    borderWidth: 1, borderColor: '#1D2B5B',
  },
  buyButton: { backgroundColor: '#1D2B5B', paddingVertical: 12, borderRadius: 8, flex: 1 },
  buttonText: { textAlign: 'center', fontWeight: '600', color: '#fff' },

  listContent: { paddingBottom: 16 },
});
