import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('secondhand_cart');
    return saved ? JSON.parse(saved) : [];
  });

  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    const saved = localStorage.getItem('secondhand_recently_viewed');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('secondhand_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('secondhand_recently_viewed', JSON.stringify(recentlyViewed));
  }, [recentlyViewed]);

  const addToCart = (item) => {
    setCart(prev => {
      const exists = prev.find(c => c.id === item.id);
      if (exists) {
        return prev.map(c => 
          c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId) => {
    setCart(prev => prev.filter(c => c.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const updateRecentlyViewedItem = (itemId, updates) => {
    setRecentlyViewed(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, ...updates } : item
      )
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.length;

  const addToRecentlyViewed = (item) => {
    setRecentlyViewed(prev => {
      const filtered = prev.filter(r => r.id !== item.id);
      return [item, ...filtered].slice(0, 10);
    });
  };

  const clearRecentlyViewed = () => {
    setRecentlyViewed([]);
  };

  return (
    <CartContext.Provider value={{
      cart,
      addToCart,
      removeFromCart,
      clearCart,
      cartTotal,
      cartCount,
      recentlyViewed,
      addToRecentlyViewed,
      clearRecentlyViewed,
      updateRecentlyViewedItem
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
