import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { api, formatPrice } from '../utils/api';

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { cart, addToCart, addToRecentlyViewed, recentlyViewed } = useCart();
  
  const [product, setProduct] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addedFeedback, setAddedFeedback] = useState(false);

  useEffect(() => {
    loadProduct();
  }, [id]);

  const loadProduct = async () => {
    setLoading(true);
    try {
      const data = await api.getGood(id);
      setProduct(data.item);
      addToRecentlyViewed(data.item);
      
      // Load recommendations
      const recsData = await api.getRecommendations(id, 8);
      setRecommendations(recsData.items || []);
    } catch (err) {
      console.error('Error loading product:', err);
      setProduct(null);
    }
    setLoading(false);
  };

  const handleAddToCart = () => {
    if (!product) return;
    addToCart({
      id: product.id,
      title: product.title,
      price: product.price,
      condition: product.condition,
      sellerName: product.sellerName,
      location: product.location
    });
    setAddedFeedback(true);
  };

  const handleBuyNow = () => {
    if (!product) return;
    if (!cart.some(c => c.id === product.id)) {
      addToCart({
        id: product.id,
        title: product.title,
        price: product.price,
        condition: product.condition,
        sellerName: product.sellerName,
        location: product.location
      });
    }
    navigate('/payment');
  };

  const isInCart = cart.some(c => c.id === product?.id);
  const recentFiltered = recentlyViewed.filter(r => r.id !== product?.id).slice(0, 8);

  if (loading) {
    return (
      <>
        <Header />
        <main className="product-page">
          <div className="product-container">
            <div className="skeleton" style={{ height: '400px', width: '100%' }}></div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Header />
        <main className="product-page">
          <div className="product-container" style={{ textAlign: 'center', padding: '60px', gridColumn: '1/-1' }}>
            <h2>Product not found</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
              The product you're looking for doesn't exist or has been removed.
            </p>
            <Link to="/" className="btn btn-primary" style={{ marginTop: '20px' }}>Back to Home</Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const conditionClass = product.condition === 'Like New' ? 'badge-success' : 
                        product.condition === 'Good' ? 'badge-primary' : 'badge-warning';

  return (
    <>
      <Header />

      {/* Breadcrumb */}
      <nav className="breadcrumb">
        <Link to="/">Home</Link>
        <span className="separator">/</span>
        <Link to={`/?category=${encodeURIComponent(product.category)}`}>{product.category}</Link>
        <span className="separator">/</span>
        <span>{product.title}</span>
      </nav>

      <main className="product-page">
        <div className="product-container">
          <div className="product-gallery">
            <img 
              className="product-main-image" 
              src={product.images?.[0] || `https://picsum.photos/seed/${product.id}/800/800`} 
              alt={product.title} 
            />
          </div>
          
          <div className="product-info">
            <div className="product-badges">
              <span className="badge badge-primary">{product.category}</span>
              <span className={`badge ${conditionClass}`}>{product.condition}</span>
            </div>
            
            <h1 className="product-title">{product.title}</h1>
            
            <div className="product-price">
              <span className="currency">CAD</span> {formatPrice(product.price)}
            </div>
            
            <div className="product-meta">
              <div className="product-meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>Seller:</span>
                <strong>{product.sellerName}</strong>
              </div>
              <div className="product-meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>Location:</span>
                <strong>{product.location}</strong>
              </div>
              <div className="product-meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>Listed:</span>
                <strong>{new Date(product.listedAt).toLocaleDateString()}</strong>
              </div>
            </div>
            
            <div className="product-description">
              <h3>Description</h3>
              <p>{product.description || 'No description provided by the seller.'}</p>
            </div>
            
            <div className="product-actions">
              <button 
                className="btn btn-lg btn-primary"
                onClick={handleAddToCart}
                disabled={!isLoggedIn}
              >
                {addedFeedback || isInCart ? (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    {addedFeedback ? 'Added to Cart!' : 'In Cart'}
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="9" cy="21" r="1"></circle>
                      <circle cx="20" cy="21" r="1"></circle>
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                    </svg>
                    Add to Cart
                  </>
                )}
              </button>
              <button 
                className="btn btn-lg btn-secondary"
                onClick={handleBuyNow}
                disabled={!isLoggedIn}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                  <line x1="1" y1="10" x2="23" y2="10"></line>
                </svg>
                Buy Now
              </button>
            </div>
            
            {!isLoggedIn && (
              <p className="notice" style={{ marginTop: '16px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                Please login or register to purchase
              </p>
            )}
          </div>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <section className="recommendation-section">
            <div className="section-header">
              <h2 className="section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                </svg>
                Customers Also Viewed
              </h2>
            </div>
            <div className="horizontal-scroll">
              {recommendations.map(item => (
                <ProductCard key={item.id} item={item} isSmall />
              ))}
            </div>
          </section>
        )}

        {/* Recently Viewed */}
        {recentFiltered.length > 0 && (
          <section className="recommendation-section">
            <div className="section-header">
              <h2 className="section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                Your Browsing History
              </h2>
            </div>
            <div className="horizontal-scroll">
              {recentFiltered.map(item => (
                <ProductCard key={item.id} item={item} isSmall />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}
