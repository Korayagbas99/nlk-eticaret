// src/context/cart.tsx
import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';

export type CartItem = { id: string; name: string; price?: number; qty: number };
type CartContextType = {
  items: CartItem[];
  total: number;
  add: (item: { id: string; name: string; price?: number }, qty?: number) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  const add: CartContextType['add'] = (item, qty = 1) =>
    setItems(prev => {
      const i = prev.findIndex(x => x.id === item.id);
      if (i !== -1) {
        const copy = [...prev];
        copy[i] = { ...copy[i], qty: copy[i].qty + qty };
        return copy;
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, qty }];
    });

  const remove = (id: string) => setItems(prev => prev.filter(x => x.id !== id));
  const clear = () => setItems([]);

  const total = useMemo(
    () => items.reduce((s, it) => s + (Number(it.price ?? 0) * it.qty), 0),
    [items]
  );

  const value = useMemo(() => ({ items, total, add, remove, clear }), [items, total]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
};
