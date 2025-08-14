// src/components/sepeteekle.tsx
import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CART_KEY = '@cart_items';

export type CartItem = {
  id: string;
  name: string;
  price: number;   // fiyat zorunlu
  qty: number;
};

type CartContextType = {
  items: CartItem[];
  total: number;
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  addMany: (list: Array<Partial<CartItem> & { id: string; name?: string }>) => void;
  inc: (id: string) => void;
  dec: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  hydrate: () => Promise<void>;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const persist = async (next: CartItem[]) => {
    setItems(next);
    try {
      await AsyncStorage.setItem(CART_KEY, JSON.stringify(next));
    } catch {}
  };

  const hydrate = async () => {
    try {
      const raw = await AsyncStorage.getItem(CART_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        // küçük şema düzeltmeleri
        const fixed = arr
          .map((x: any): CartItem | null => {
            const id = String(x?.id || '').trim();
            const name = String(x?.name || '').trim();
            const price = Number(x?.price || 0) || 0;
            const qty = Number(x?.qty || 0) || 0;
            if (!id || !name || !qty) return null;
            return { id, name, price, qty };
          })
          .filter(Boolean) as CartItem[];
        setItems(fixed);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    void hydrate();
  }, []);

  const total = useMemo(
    () => items.reduce((s, it) => s + it.price * it.qty, 0),
    [items]
  );

  const add = (item: Omit<CartItem, 'qty'>, qty: number = 1) => {
    const q = Math.max(1, Math.floor(qty));
    const next = [...items];
    const idx = next.findIndex((x) => x.id === item.id);
    if (idx >= 0) {
      next[idx] = { ...next[idx], qty: next[idx].qty + q, name: item.name, price: item.price };
    } else {
      next.unshift({ ...item, qty: q });
    }
    void persist(next);
  };

  // 🔥 Toplu ekleme: “Tekrar Satın Al” bununla yapılacak
  const addMany = (list: Array<Partial<CartItem> & { id: string; name?: string }>) => {
    if (!Array.isArray(list) || list.length === 0) return;
    const next = [...items];

    for (const raw of list) {
      const id = String(raw.id || '').trim();
      const name = String(raw.name || '').trim();
      const price = Number(raw.price || 0) || 0;
      const qty = Math.max(1, Number(raw.qty || 1));

      if (!id || !name) continue; // boş veri ekleme
      const idx = next.findIndex((x) => x.id === id);
      if (idx >= 0) {
        // Birleştir: qty artır, adı/fiyatı güncelle
        next[idx] = {
          ...next[idx],
          qty: next[idx].qty + qty,
          name: name || next[idx].name,
          price: price || next[idx].price,
        };
      } else {
        next.unshift({ id, name, price, qty });
      }
    }

    void persist(next);
  };

  const inc = (id: string) => {
    const next = items.map((x) => (x.id === id ? { ...x, qty: x.qty + 1 } : x));
    void persist(next);
  };

  const dec = (id: string) => {
    const next = items
      .map((x) => (x.id === id ? { ...x, qty: Math.max(1, x.qty - 1) } : x))
      .filter((x) => x.qty > 0);
    void persist(next);
  };

  const remove = (id: string) => {
    const next = items.filter((x) => x.id !== id);
    void persist(next);
  };

  const clear = () => {
    void persist([]);
  };

  const value: CartContextType = {
    items,
    total,
    add,
    addMany,
    inc,
    dec,
    remove,
    clear,
    hydrate,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
