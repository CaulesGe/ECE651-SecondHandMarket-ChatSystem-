import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { api, formatPrice } from '../utils/api';

export default function ProductCard({ item, isSmall = false, onFavoriteChange }) {
  const { user, isLoggedIn } = useAuth();
  const { cart, addToCart, addToRecentlyViewed, updateRecentlyViewedItem } = useCart();
  const navigate = useNavigate();

  const [addedFeedback, setAddedFeedback] = useState(false);
  const [isFavorited, setIsFavorited] = useState(Boolean(item.isFavorited));
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  useEffect(() => {
    setIsFavorited(Boolean(item.isFavorited));
  }, [item.isFavorited, item.id]);

  const conditionClass =
    item.condition === 'Like New'
      ? 'badge-success'
      : item.condition === 'Good'
        ? 'badge-primary'
        : 'badge-warning';

  const isOutOfStock = Number(item.quantity || 0) <= 0;
  const isOwnListing = Boolean(user?.id && item.sellerId && user.id === item.sellerId);
  const currentCartItem = cart.find((cartItem) => cartItem.id === item.id);
  const currentCartQuantity = Number(currentCartItem?.quantity || 0);
  const availableStock = Number(item.quantity || 0);      

  const handleCardClick = (e) => {
    if (e.target.closest('.add-cart-btn')) return;
    if (e.target.closest('.favorite-btn')) return;
    addToRecentlyViewed(item);
    navigate(`/product/${item.id}`);
  };

  const handleAddToCart = (e) => {
    e.stopPropagation();

    if (isOwnListing) {
      alert('You cannot buy your own listing.');
      return;
    }

    if (isOutOfStock) {
      alert('This item is out of stock.');
      return;
    }

    if (currentCartQuantity + 1 > availableStock) {
      alert(`Cannot add more. Only ${availableStock} item(s) available in stock.`);
      return;
    }

    addToCart({
      id: item.id,
      title: item.title,
      price: item.price,
      condition: item.condition,
      sellerName: item.sellerName,
      sellerId: item.sellerId,
      location: item.location,
      quantity: 1,
      availableQuantity: item.quantity
    }, user);

    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1500);
  };

  const handleToggleFavorite = async (e) => {
    e.stopPropagation();
    if (!isLoggedIn || favoriteLoading) return;

    setFavoriteLoading(true);
    try {
      if (isFavorited) {
        await api.removeFavorite(item.id, user);
        setIsFavorited(false);
        updateRecentlyViewedItem(item.id, { isFavorited: false });
        onFavoriteChange?.(item.id, false);
      } else {
        await api.addFavorite(item.id, user);
        setIsFavorited(true);
        updateRecentlyViewedItem(item.id, { isFavorited: true });
        onFavoriteChange?.(item.id, true);
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    } finally {
      setFavoriteLoading(false);
    }
  };

  return (
    <div className="card" onClick={handleCardClick}>
      <div className="card-image" style={{ position: 'relative' }}>
        <img
          src={item.images?.[0] || `https://picsum.photos/seed/${item.id}/600/400`}
          alt={item.title}
          loading="lazy"
        />

        <button
          className="favorite-btn"
          onClick={handleToggleFavorite}
          disabled={!isLoggedIn || favoriteLoading}
          title={!isLoggedIn ? 'Login to save items' : isFavorited ? 'Remove from favorites' : 'Save item'}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            width: '38px',
            height: '38px',
            borderRadius: '999px',
            border: 'none',
            background: 'rgba(255,255,255,0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: !isLoggedIn ? 'not-allowed' : 'pointer',
            opacity: !isLoggedIn ? 0.55 : 1,
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
          }}
        >
          {isFavorited ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
              <path d="M12 21s-6.716-4.35-9.193-8.176C.662 9.53 2.206 5.25 6.06 4.24c2.047-.537 4.194.12 5.94 1.84 1.746-1.72 3.893-2.377 5.94-1.84 3.854 1.01 5.398 5.29 3.253 8.584C18.716 16.65 12 21 12 21z"></path>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 21s-6.716-4.35-9.193-8.176C.662 9.53 2.206 5.25 6.06 4.24c2.047-.537 4.194.12 5.94 1.84 1.746-1.72 3.893-2.377 5.94-1.84 3.854 1.01 5.398 5.29 3.253 8.584C18.716 16.65 12 21 12 21z"></path>
            </svg>
          )}
        </button>
      </div>

      <div className="card-body">
        <div className="card-badges">
          <span className="badge badge-primary">{item.category}</span>
          <span className={`badge ${conditionClass}`}>{item.condition}</span>
        </div>
        <h3>{item.title}</h3>
        {!isSmall && <p>{item.description || 'No description provided.'}</p>}
        <div className="card-meta">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          {item.location}
        </div>
        <div
          className="card-meta"
          style={{ marginTop: '6px', color: isOutOfStock ? '#b91c1c' : 'var(--text-muted)' }}
        >
          {isOutOfStock ? 'Sold out' : `Stock: ${item.quantity}`}
        </div>
      </div>

      <div className="card-footer">
        <div className="price">
          <span className="price-currency">CAD</span> {formatPrice(item.price)}
        </div>
        <button
          className="btn btn-sm btn-primary add-cart-btn"
          onClick={handleAddToCart}
          disabled={!isLoggedIn || isOutOfStock || isOwnListing}
          title={
            !isLoggedIn
              ? 'Register to add items to cart'
              : isOutOfStock
                ? 'This item is out of stock'
                : isOwnListing
                  ? 'You cannot buy your own listing'
                  : ''
          }
          style={!isLoggedIn || isOutOfStock ? { opacity: 0.5 } : {}}
        >
          {isOutOfStock ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              Sold Out
            </>
          ) : addedFeedback ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Added!
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              Add
            </>
          )}
        </button>
      </div>
    </div>
  );
}
