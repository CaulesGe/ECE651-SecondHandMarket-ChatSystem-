import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';
import CartPanel from '../components/CartPanel';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { api } from '../utils/api';

export default function HomePage() {
  const { user, isLoggedIn } = useAuth();
  const { recentlyViewed, clearRecentlyViewed } = useCart();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef(null);
  
  const [goods, setGoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [currentCategory, setCurrentCategory] = useState(searchParams.get('category') || 'All');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [loading, setLoading] = useState(true);

  // Sell panel state
  const [showSellPanel, setShowSellPanel] = useState(false);
  const [sellForm, setSellForm] = useState({
    title: '', price: '', condition: 'Like New', category: '', description: '', imageFile: null
  });
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [sellNotice, setSellNotice] = useState({ show: false, message: '', isError: false });

  useEffect(() => {
    loadData();
  }, [searchParams]);

  useEffect(() => () => {
    if (previewImageUrl) {
      URL.revokeObjectURL(previewImageUrl);
    }
  }, [previewImageUrl]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [goodsRes, catsRes] = await Promise.all([
        api.getGoods(searchParams.get('search') || '', searchParams.get('category') || ''),
        api.getCategories()
      ]);
      setGoods(goodsRes.items || []);
      setCategories(catsRes.categories || []);
      if (catsRes.categories?.length && !sellForm.category) {
        setSellForm(prev => ({ ...prev, category: catsRes.categories[0] }));
      }
    } catch (err) {
      console.error('Error loading data:', err);
    }
    setLoading(false);
  };

  const filteredGoods = goods.filter(g => {
    if (currentCategory !== 'All' && g.category !== currentCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return g.title.toLowerCase().includes(q) || 
             g.description?.toLowerCase().includes(q) ||
             g.category.toLowerCase().includes(q);
    }
    return true;
  });

  const recommended = goods.slice(0, 8);
  const previewDescription = sellForm.description.trim()
    ? `${sellForm.description.trim().slice(0, 120)}${sellForm.description.trim().length > 120 ? '...' : ''}`
    : 'Add a clear description so buyers can decide quickly.';
  const descriptionCount = sellForm.description.length;
  const selectedImageSizeLabel = sellForm.imageFile
    ? `${(sellForm.imageFile.size / (1024 * 1024)).toFixed(2)} MB`
    : '';

  const handleCategoryClick = (cat) => {
    setCurrentCategory(cat);
  };

  const resetSellForm = () => {
    if (previewImageUrl) {
      URL.revokeObjectURL(previewImageUrl);
    }
    setPreviewImageUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setSellForm({
      title: '',
      price: '',
      condition: 'Like New',
      category: categories[0] || '',
      description: '',
      imageFile: null
    });
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0] || null;
    setSellForm(prev => ({ ...prev, imageFile: file }));

    if (previewImageUrl) {
      URL.revokeObjectURL(previewImageUrl);
    }

    if (file) {
      setPreviewImageUrl(URL.createObjectURL(file));
      return;
    }

    setPreviewImageUrl('');
  };

  const handleSellSubmit = async (e) => {
    e.preventDefault();
    if (!sellForm.title || !sellForm.price || !sellForm.category) {
      setSellNotice({ show: true, message: 'Please fill out all required fields.', isError: true });
      return;
    }

    try {
      let imageUrl = '';
      if (sellForm.imageFile) {
        const uploadResult = await api.uploadGoodImage(sellForm.imageFile, user);
        imageUrl = uploadResult.url || '';
      }

      await api.createGood({
        title: sellForm.title,
        price: parseFloat(sellForm.price),
        condition: sellForm.condition,
        category: sellForm.category,
        description: sellForm.description,
        images: imageUrl ? [imageUrl] : []
      }, user);

      setSellNotice({ show: true, message: 'Listing published successfully!', isError: false });
      resetSellForm();
      loadData();
    } catch (err) {
      setSellNotice({ show: true, message: err?.message || 'Failed to publish listing. Try again.', isError: true });
    }
  };

  return (
    <>
      <Header />
      
      {/* Hero Banner */}
      <section className="hero-banner">
        <div className="hero-content">
          <h1>Find Amazing Deals on Pre-Loved Items</h1>
          <p>Thousands of quality second-hand products at great prices. Buy and sell with your local community.</p>
          <div className="hero-stats">
            <div className="hero-stat">
              <strong>{goods.length}</strong>
              <span>Active Listings</span>
            </div>
            <div className="hero-stat">
              <strong>{categories.length}</strong>
              <span>Categories</span>
            </div>
            <div className="hero-stat">
              <strong>100%</strong>
              <span>Secure</span>
            </div>
          </div>
        </div>
      </section>

      {/* Category Pills */}
      <section className="category-section">
        <div className="category-pills">
          <button 
            className={`category-pill ${currentCategory === 'All' ? 'active' : ''}`}
            onClick={() => handleCategoryClick('All')}
          >
            All Items
          </button>
          {categories.map(cat => (
            <button 
              key={cat}
              className={`category-pill ${currentCategory === cat ? 'active' : ''}`}
              onClick={() => handleCategoryClick(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      <main className="main-container">
        <div className="main-grid">
          <section className="products-section">
            {/* Recently Viewed */}
            {recentlyViewed.length > 0 && (
              <div className="recommendation-section">
                <div className="section-header">
                  <h2 className="section-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    Recently Viewed
                  </h2>
                  <button className="clear-btn" onClick={clearRecentlyViewed}>Clear</button>
                </div>
                <div className="horizontal-scroll">
                  {recentlyViewed.map(item => (
                    <ProductCard key={item.id} item={item} isSmall />
                  ))}
                </div>
              </div>
            )}

            {/* Recommended */}
            <div className="recommendation-section">
              <div className="section-header">
                <h2 className="section-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                  </svg>
                  Recommended For You
                </h2>
              </div>
              <div className="horizontal-scroll">
                {recommended.map(item => (
                  <ProductCard key={item.id} item={item} isSmall />
                ))}
              </div>
            </div>

            {/* Sell Panel */}
            {isLoggedIn && (
              <div className="sell-panel">
                <div className="sell-panel-shell">
                  <div className="sell-panel-main">
                    <div className="sell-panel-header">
                      <div className="sell-panel-kicker-row">
                        <span className="sell-panel-kicker">Seller Studio</span>
                        <span className="sell-panel-kicker sell-panel-kicker-soft">Quick Publish</span>
                      </div>
                      <h2>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        List a New Item
                      </h2>
                      <p>Build a clean listing in under one minute. Required fields are marked.</p>
                      <div className="sell-panel-points">
                        <span>60s average setup</span>
                        <span>Real-time preview</span>
                        <span>Instant publish</span>
                      </div>
                    </div>

                    <form className="sell-panel-form" onSubmit={handleSellSubmit}>
                      <div className="form-row">
                        <div className="form-group sell-field">
                          <label>
                            Title
                            <span className="required-mark">Required</span>
                          </label>
                          <input
                            value={sellForm.title}
                            onChange={(e) => setSellForm({ ...sellForm, title: e.target.value })}
                            placeholder="Vintage lamp, winter jacket..."
                          />
                        </div>
                        <div className="form-group sell-field">
                          <label>
                            Price (CAD)
                            <span className="required-mark">Required</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={sellForm.price}
                            onChange={(e) => setSellForm({ ...sellForm, price: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group sell-field">
                          <label>Condition</label>
                          <select
                            value={sellForm.condition}
                            onChange={(e) => setSellForm({ ...sellForm, condition: e.target.value })}
                          >
                            <option>Like New</option>
                            <option>Good</option>
                            <option>Fair</option>
                          </select>
                        </div>
                        <div className="form-group sell-field">
                          <label>
                            Category
                            <span className="required-mark">Required</span>
                          </label>
                          <select
                            value={sellForm.category}
                            onChange={(e) => setSellForm({ ...sellForm, category: e.target.value })}
                          >
                            {categories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="form-group sell-field">
                        <label>Description</label>
                        <textarea
                          rows="4"
                          maxLength={500}
                          value={sellForm.description}
                          onChange={(e) => setSellForm({ ...sellForm, description: e.target.value })}
                          placeholder="Describe your item..."
                        />
                        <div className="sell-field-meta">
                          <span>Tip: Include brand, condition details, and pickup location.</span>
                          <span>{descriptionCount}/500</span>
                        </div>
                      </div>
                      <div className="form-group sell-photo-group">
                        <label>Cover Photo</label>
                        <input
                          id="sell-photo-input"
                          className="sell-file-input"
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          ref={fileInputRef}
                          onChange={handleImageSelect}
                        />
                        <label
                          htmlFor="sell-photo-input"
                          className={`sell-upload-card ${sellForm.imageFile ? 'has-file' : ''}`}
                        >
                          <span className="sell-upload-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="17 8 12 3 7 8"></polyline>
                              <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                          </span>
                          <span className="sell-upload-copy">
                            <strong>{sellForm.imageFile ? sellForm.imageFile.name : 'Choose or drop an image'}</strong>
                            <small>
                              {sellForm.imageFile
                                ? `${selectedImageSizeLabel} · Ready to upload`
                                : 'JPG, PNG, WEBP or GIF · max 5MB'}
                            </small>
                          </span>
                        </label>
                      </div>

                      <div className="sell-panel-form-footer">
                        <p>Your listing goes live immediately after publish.</p>
                        <button type="submit" className="btn btn-primary sell-submit-btn">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                          </svg>
                          Publish Listing
                        </button>
                      </div>
                    </form>

                    {sellNotice.show && (
                      <p className={`notice sell-notice ${sellNotice.isError ? 'notice-error' : 'notice-success'}`}>
                        {sellNotice.message}
                      </p>
                    )}
                  </div>

                  <aside className="sell-panel-side">
                    <span className="sell-preview-label">Live Preview</span>
                    <h3 className="sell-preview-title">{sellForm.title || 'Your item title will appear here'}</h3>
                    <div className="sell-preview-price">
                      {sellForm.price ? `CAD ${sellForm.price}` : 'Set your price'}
                    </div>
                    <div className="sell-preview-meta">
                      <span>{sellForm.condition}</span>
                      <span>{sellForm.category || 'Pick category'}</span>
                    </div>
                    <div className="sell-preview-image-shell">
                      {previewImageUrl ? (
                        <img
                          src={previewImageUrl}
                          alt="Listing preview"
                          className="sell-preview-image"
                        />
                      ) : (
                        <div className="sell-preview-image-placeholder">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                          </svg>
                          <span>Your cover photo appears here</span>
                        </div>
                      )}
                    </div>
                    <p className="sell-preview-description">{previewDescription}</p>

                    <ul className="sell-checklist">
                      <li>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Add a precise title to improve search ranking.
                      </li>
                      <li>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Include one clean photo for higher click-through.
                      </li>
                      <li>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Honest condition and details reduce negotiation friction.
                      </li>
                    </ul>
                  </aside>
                </div>
              </div>
            )}

            {/* All Products */}
            <div className="section-header">
              <h2 className="section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
                {searchQuery ? `Search results for "${searchQuery}"` : currentCategory === 'All' ? 'All Products' : currentCategory}
              </h2>
              <span className="results-count">{filteredGoods.length} items</span>
            </div>

            <div className="goods-grid">
              {loading ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                  Loading...
                </div>
              ) : filteredGoods.length === 0 ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '16px', opacity: 0.5 }}>
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <p>No items found matching your search</p>
                </div>
              ) : (
                filteredGoods.map(item => (
                  <ProductCard key={item.id} item={item} />
                ))
              )}
            </div>
          </section>

          <CartPanel />
        </div>
      </main>

      <Footer />
    </>
  );
}
