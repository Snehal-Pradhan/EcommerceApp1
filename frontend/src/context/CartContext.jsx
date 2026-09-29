import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState({ items: [], subtotal: '0.00', item_count: 0 });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setCart({ items: [], subtotal: '0.00', item_count: 0 });
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/cart');
      setCart(data);
    } catch {
      setCart({ items: [], subtotal: '0.00', item_count: 0 });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (productId, quantity = 1) => {
      const { data } = await api.post('/cart/items', { product_id: productId, quantity });
      setCart(data);
      return data;
    },
    [],
  );

  const updateItem = useCallback(async (productId, quantity) => {
    const { data } = await api.put(`/cart/items/${productId}`, { quantity });
    setCart(data);
    return data;
  }, []);

  const removeItem = useCallback(async (productId) => {
    const { data } = await api.delete(`/cart/items/${productId}`);
    setCart(data);
    return data;
  }, []);

  const clear = useCallback(async () => {
    const { data } = await api.delete('/cart');
    setCart(data);
    return data;
  }, []);

  const value = useMemo(
    () => ({ cart, loading, refresh, addItem, updateItem, removeItem, clear }),
    [cart, loading, refresh, addItem, updateItem, removeItem, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside <CartProvider>');
  return context;
}
