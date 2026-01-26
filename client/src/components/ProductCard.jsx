import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/api';

export default function ProductCard({ item, isSmall = false }) {
  const { isLoggedIn } = useAuth();
  const { addToCart, addToRecentlyViewed } = useCart();
  const navigate = useNavigate();
  const [addedFeedback, setAddedFeedback] = useState(false);

  const conditionClass = item.condition === 'Like New' ? 'badge-success' : 
                        item.condition === 'Good' ? 'badge-primary' : 'badge-warning';

  const handleCardClick = (e) => {
    if (e.target.closest('.add-cart-btn')) return;
    addToRecentlyViewed(item);
    navigate(`/product/${item.id}`);
  };

  const handleAddToCart = (e) => {
    e.stopPropagation();
    addToCart({
      id: item.id,
      title: item.title,
      price: item.price,
      condition: item.condition,
      sellerName: item.sellerName,
      location: item.location
    });
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1500);
  };

  return (
    <div className="card" onClick={handleCardClick}>
      <div className="card-image">
        <img 
          src={item.images?.[0] || `https://picsum.photos/seed/${item.id}/600/400`} 
          alt={item.title} 
          loading="lazy" 
        />
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
      </div>
      <div className="card-footer">
        <div className="price">
          <span className="price-currency">CAD</span> {formatPrice(item.price)}
        </div>
        <button 
          className="btn btn-sm btn-primary add-cart-btn"
          onClick={handleAddToCart}
          disabled={!isLoggedIn}
          title={!isLoggedIn ? 'Register to add items to cart' : ''}
          style={!isLoggedIn ? { opacity: 0.5 } : {}}
        >
          {addedFeedback ? (
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
