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

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);

  const addToRecentlyViewed = (item) => {
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((r) => r.id !== item.id);
      return [item, ...filtered].slice(0, 10);
    });
  };

  const clearRecentlyViewed = () => {
    setRecentlyViewed([]);
  };

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