import React, {createContext, useContext, useMemo, useState, ReactNode} from "react";

export type FavoriteProduct = {
  id: string;
  title: string;
  priceMonthly: number;      // Aylık değer
  imageUrl?: string;
  addedDate?: string;        // "20 Mart 2024" gibi
};

type FavoritesContextType = {
  favorites: FavoriteProduct[];
  favoritesCount: number;
  totalMonthlyValue: number;
  isFavorite: (id: string) => boolean;
  addFavorite: (p: FavoriteProduct) => void;
  removeFavorite: (id: string) => void;
  toggleFavorite: (p: FavoriteProduct) => void;
};

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({children}: {children: ReactNode}) {
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);

  const favoritesCount = favorites.length;
  const totalMonthlyValue = useMemo(
    () => favorites.reduce((sum, p) => sum + (p.priceMonthly || 0), 0),
    [favorites]
  );

  const isFavorite = (id: string) => favorites.some(f => f.id === id);

  const addFavorite = (p: FavoriteProduct) => {
    setFavorites(prev => (prev.some(f => f.id === p.id) ? prev : [{...p, addedDate: p.addedDate ?? new Date().toLocaleDateString("tr-TR")}, ...prev]));
  };

  const removeFavorite = (id: string) => {
    setFavorites(prev => prev.filter(f => f.id !== id));
  };

  const toggleFavorite = (p: FavoriteProduct) => {
    setFavorites(prev => (prev.some(f => f.id === p.id) ? prev.filter(f => f.id !== p.id) : [{...p, addedDate: p.addedDate ?? new Date().toLocaleDateString("tr-TR")}, ...prev]));
  };

  const value = {favorites, favoritesCount, totalMonthlyValue, isFavorite, addFavorite, removeFavorite, toggleFavorite};
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
