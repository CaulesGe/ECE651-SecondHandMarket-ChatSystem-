import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

const getStorageKeys = (user) => {
  const scope = user?.id ? `user_${user.id}` : 'guest';
  return {
    cartKey: `secondhand_cart_${scope}`,
    recentlyViewedKey: `secondhand_recently_viewed_${scope}`
  };
};

const readJsonArray = (key) => {
  try {
    const saved = localStorage.getItem(key);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`Failed to read localStorage key: ${key}`, error);
    return [];
  }
};

export function CartProvider({ children }) {
  const { user } = useAuth();

  const [cart, setCart] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);

  useEffect(() => {
    const { cartKey, recentlyViewedKey } = getStorageKeys(user);
    setCart(readJsonArray(cartKey));
    setRecentlyViewed(readJsonArray(recentlyViewedKey));
  }, [user?.id, user?.role]);

  useEffect(() => {
    const { cartKey } = getStorageKeys(user);
    localStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cart, user?.id, user?.role]);

  useEffect(() => {
    const { recentlyViewedKey } = getStorageKeys(user);
    localStorage.setItem(recentlyViewedKey, JSON.stringify(recentlyViewed));
  }, [recentlyViewed, user?.id, user?.role]);

  const addToCart = (item, currentUser = null) => {
    const availableQuantity = Number(item?.availableQuantity ?? item?.quantity ?? 1);
    const sellerId = item?.sellerId || null;

    if (currentUser?.id && sellerId && currentUser.id === sellerId) {
      alert('You cannot buy your own listing.');
      return false;
    }

    if (availableQuantity <= 0) {
      alert('This item is out of stock.');
      return false;
    }

    let added = false;
    let blocked = false;

    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);

      if (existing) {
        const currentQuantity = Number(existing.quantity || 1);

        if (currentQuantity + 1 > availableQuantity) {
          blocked = true;
          return prev;
        }

        added = true;
        return prev.map((c) =>
          c.id === item.id
            ? {
                ...c,
                quantity: currentQuantity + 1,
                availableQuantity,
                sellerId
              }
            : c
        );
      }

      added = true;
      return [
        ...prev,
        {
          ...item,
          quantity: 1,
          availableQuantity,
          sellerId
        }
      ];
    });

    if (blocked) {
      alert(`Cannot add more. Only ${availableQuantity} item(s) available in stock.`);
      return false;
    }

    return added;
  };

  const removeFromCart = (itemId) => {
    setCart((prev) => prev.filter((c) => c.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const updateCartItemQuantity = (itemId, nextQuantity) => {
    const normalizedQuantity = Number.parseInt(nextQuantity, 10);

    if (!Number.isInteger(normalizedQuantity) || normalizedQuantity <= 0) {
      removeFromCart(itemId);
      return false;
    }

    let updated = false;
    let blocked = false;
    let stockLimit = 1;

    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;

        const availableQuantity = Number(item.availableQuantity ?? item.quantity ?? 1);
        stockLimit = availableQuantity;

        if (normalizedQuantity > availableQuantity) {
          blocked = true;
          return item;
        }

        updated = true;
        return {
          ...item,
          quantity: normalizedQuantity
        };
      })
    );

    if (blocked) {
      alert(`Cannot set quantity higher than stock. Only ${stockLimit} item(s) available.`);
      return false;
    }

    return updated;
  };

  const updateRecentlyViewedItem = (itemId, updates) => {
    setRecentlyViewed((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      )
    );
  };

  const addToRecentlyViewed = (item) => {
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((r) => r.id !== item.id);
      return [item, ...filtered].slice(0, 10);
    });
  };

  const clearRecentlyViewed = () => {
    setRecentlyViewed([]);
  };

  const removeRecentlyViewedItem = (itemId) => {
    setRecentlyViewed((prev) => prev.filter((item) => item.id !== itemId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        updateCartItemQuantity,
        cartTotal,
        cartCount,
        recentlyViewed,
        addToRecentlyViewed,
        clearRecentlyViewed,
        removeRecentlyViewedItem,
        updateRecentlyViewedItem
      }}
    >
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