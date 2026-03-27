import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { api, formatPrice } from '../utils/api';
import ProductCard from '../components/ProductCard';

export default function ProfilePage() {
  const { user, isLoggedIn, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [tab, setTab] = useState('purchased');

  const [profile, setProfile] = useState({
    name: '',
    address: '',
    email: '',
    phone: '',
    gender: '',
  });

  const [profileLoading, setProfileLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);

  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);

  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);

  const [selling, setSelling] = useState([]);
  const [sellingLoading, setSellingLoading] = useState(false);

  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [purchaseHistoryLoading, setPurchaseHistoryLoading] = useState(false);

  const [salesHistory, setSalesHistory] = useState([]);
  const [salesHistoryLoading, setSalesHistoryLoading] = useState(false);

  const [reviews, setReviews] = useState({ received: [], given: [] });
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleFavoriteChange = (itemId, nextIsFavorited) => {
    setFavorites((prev) =>
      nextIsFavorited
        ? prev.map((item) =>
            item.id === itemId ? { ...item, isFavorited: true } : item
          )
        : prev.filter((item) => item.id !== itemId)
    );
  };

  const loadProfile = async () => {
    try {
      setProfileLoading(true);
      const res = await api.getProfile(user);
      setProfile({
        name: res.profile.name || '',
        address: res.profile.address || '',
        email: res.profile.email || '',
        phone: res.profile.phone || '',
        gender: res.profile.gender || '',
      });
    } catch (error) {
      alert(error.message || 'Failed to load profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const loadPurchaseHistory = async () => {
    try {
      setPurchaseHistoryLoading(true);
      const res = await api.getMyPurchaseHistory(user);
      setPurchaseHistory(res.items || []);
    } catch (error) {
      alert(error.message || 'Failed to load purchase history.');
    } finally {
      setPurchaseHistoryLoading(false);
    }
  };

  const loadSelling = async () => {
    try {
      setSellingLoading(true);
      const res = await api.getMyListings(user);
      setSelling(res.items || []);
    } catch (error) {
      alert(error.message || 'Failed to load selling items.');
    } finally {
      setSellingLoading(false);
    }
  };

  const loadSalesHistory = async () => {
    try {
      setSalesHistoryLoading(true);
      const res = await api.getMySalesHistory(user);
      setSalesHistory(res.items || []);
    } catch (error) {
      alert(error.message || 'Failed to load sold records.');
    } finally {
      setSalesHistoryLoading(false);
    }
  };

  const loadDrafts = async () => {
    try {
      setDraftsLoading(true);
      const res = await api.getDrafts(user);
      setDrafts(res.items || []);
    } catch (error) {
      alert(error.message || 'Failed to load drafts.');
    } finally {
      setDraftsLoading(false);
    }
  };

  const loadFavorites = async () => {
    try {
      setFavoritesLoading(true);
      const res = await api.getFavorites(user);
      setFavorites(res.items || []);
    } catch (error) {
      alert(error.message || 'Failed to load favorites.');
    } finally {
      setFavoritesLoading(false);
    }
  };

  const loadReviews = async () => {
    try {
      setReviewsLoading(true);
      const res = await api.getMyTradeReviews(user);
      setReviews({
        received: res.received || [],
        given: res.given || []
      });
    } catch (error) {
      alert(error.message || 'Failed to load reviews.');
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn || !user) return;
    loadProfile();
  }, [isLoggedIn, user]);

  useEffect(() => {
    if (!isLoggedIn || !user) return;

    if (tab === 'purchased') {
      loadPurchaseHistory();
    } else if (tab === 'selling') {
      loadSelling();
    } else if (tab === 'sold') {
      loadSalesHistory();
    } else if (tab === 'drafts') {
      loadDrafts();
    } else if (tab === 'favorites') {
      loadFavorites();
    } else if (tab === 'reviews') {
      loadReviews();
    }
  }, [tab, isLoggedIn, user]);

  useEffect(() => {
    if (location.state?.openTab) {
      setTab(location.state.openTab);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  const handleSave = async () => {
    try {
      setSaveLoading(true);

      const payload = {
        name: profile.name.trim(),
        address: profile.address,
        phone: profile.phone,
        gender: profile.gender,
      };

      const res = await api.updateProfile(payload, user);
      console.log('update profile response:', res);

      const nextProfile = {
        name: res.profile.name || '',
        address: res.profile.address || '',
        email: res.profile.email || '',
        phone: res.profile.phone || '',
        gender: res.profile.gender || '',
      };
      setProfile(nextProfile);

      updateUser({
        name: nextProfile.name,
        email: nextProfile.email,
        address: nextProfile.address,
        phone: nextProfile.phone,
        gender: nextProfile.gender
      });

      alert('Profile saved successfully.');
    } catch (error) {
      alert(error.message || 'Failed to save profile.');
    } finally {
      setSaveLoading(false);
    }
  };

  const initials = (profile.name?.trim() || user?.name?.trim() || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const formatDraftUpdatedAt = (value) => {
    if (!value) return 'Just now';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Just now';
    return date.toLocaleString();
  };

  if (!isLoggedIn) {
    navigate('/login');
    return null;
  }

  const isTabLoading =
    (tab === 'purchased' && purchaseHistoryLoading) ||
    (tab === 'selling' && sellingLoading) ||
    (tab === 'sold' && salesHistoryLoading) ||
    (tab === 'drafts' && draftsLoading) ||
    (tab === 'favorites' && favoritesLoading)
    || (tab === 'reviews' && reviewsLoading);

  return (
    <>
      <Header showSearch={false} subtitle="Manage your profile" />

      <div className="profile-page">
        <h1 style={{ marginBottom: '30px' }}>My Profile</h1>

        <div className="profile-layout">
          <div className="profile-card">
            <div className="avatar">{initials}</div>
            <div className="username">{profile.name?.trim() || user?.name?.trim() || 'User'}</div>

            <h2>Personal Information</h2>

            {profileLoading ? (
              <p>Loading profile...</p>
            ) : (
              <>
                <div className="form-group">
                  <label>Name</label>
                  <input
                    name="name"
                    value={profile.name}
                    onChange={handleChange}
                    placeholder="Enter your name"
                  />
                </div>

                <div className="form-group">
                  <label>Address</label>
                  <input
                    name="address"
                    value={profile.address}
                    onChange={handleChange}
                    placeholder="Enter your address"
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    name="email"
                    value={profile.email}
                    disabled
                    placeholder="Enter your email"
                  />
                </div>

                <div className="form-group">
                  <label>Phone</label>
                  <input
                    name="phone"
                    value={profile.phone}
                    onChange={handleChange}
                    placeholder="Enter your phone number"
                  />
                </div>

                <div className="form-group">
                  <label>Gender</label>
                  <select name="gender" value={profile.gender} onChange={handleChange}>
                    <option value="">Select</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>

                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={handleSave}
                  disabled={saveLoading}
                >
                  {saveLoading ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
          </div>

          <div className="products-card">
            <h2>My Products</h2>

            <div className="tabs">
              <button
                className={tab === 'purchased' ? 'active' : ''}
                onClick={() => setTab('purchased')}
              >
                Purchased
              </button>
              <button
                className={tab === 'selling' ? 'active' : ''}
                onClick={() => setTab('selling')}
              >
                Selling
              </button>
              <button
                className={tab === 'sold' ? 'active' : ''}
                onClick={() => setTab('sold')}
              >
                Sold
              </button>
              <button
                className={tab === 'drafts' ? 'active' : ''}
                onClick={() => setTab('drafts')}
              >
                Drafts
              </button>
              <button
                className={tab === 'favorites' ? 'active' : ''}
                onClick={() => setTab('favorites')}
              >
                Favorites
              </button>
              <button
                className={tab === 'reviews' ? 'active' : ''}
                onClick={() => setTab('reviews')}
              >
                Reviews
              </button>
            </div>

            {isTabLoading ? (
              <ul className="product-list">
                <li style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>
                  Loading...
                </li>
              </ul>
            ) : tab === 'purchased' ? (
              <div className="profile-cards-grid">
                {purchaseHistory.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>No purchased items yet.</p>
                ) : (
                  purchaseHistory.map((item) => (
                    <div
                      key={`${item.transactionId}-${item.transactionItemId}`}
                      className="card"
                      style={{ cursor: item.goodsId ? 'pointer' : 'default', marginBottom: '16px' }}
                      onClick={() => item.goodsId && navigate(`/product/${item.goodsId}`)}
                    >
                      <div className="card-body">
                        <div className="card-badges">
                          <span className="badge badge-success">{item.status}</span>
                          <span className="badge badge-primary">Qty {item.quantity}</span>
                        </div>

                        <h3>{item.title}</h3>
                        <p>Seller: {item.sellerName || 'Unknown seller'}</p>
                        <div className="card-meta">
                          Purchased on {new Date(item.purchasedAt).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="card-footer" style={{ justifyContent: 'space-between' }}>
                        <div className="price">
                          <span className="price-currency">CAD</span> {formatPrice(item.price)}
                        </div>

                        {item.buyerReviewSubmitted ? (
                          <button className="btn btn-sm btn-secondary" disabled>
                            Reviewed
                          </button>
                        ) : (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate('/trade-review', {
                                state: {
                                  transactionItemId: item.transactionItemId,
                                  direction: 'BUYER_TO_SELLER',
                                  title: item.title,
                                  targetName: item.sellerName || 'Seller',
                                  fromTab: 'purchased'
                                }
                              });
                            }}
                          >
                            Review Seller
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : tab === 'selling' ? (
              selling.length === 0 ? (
                <ul className="product-list">
                  <li style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>
                    No active listings
                  </li>
                </ul>
              ) : (
                <div>
                  {selling.map((item) => (
                    <div key={item.id} style={{ marginBottom: '16px' }}>
                      <ProductCard item={item} />
                    </div>
                  ))}
                </div>
              )
            ) : tab === 'sold' ? (
              <div className="profile-cards-grid">
                {salesHistory.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>No sold records yet.</p>
                ) : (
                  salesHistory.map((item) => (
                    <div
                      key={`${item.transactionId}-${item.transactionItemId}`}
                      className="card"
                      style={{ marginBottom: '16px' }}
                    >
                      <div className="card-body">
                        <div className="card-badges">
                          <span className="badge badge-warning">Sold</span>
                          <span className="badge badge-primary">Qty {item.quantity}</span>
                        </div>

                        <h3>{item.title}</h3>
                        <p>Sold to: {item.buyerName}</p>
                        <div className="card-meta">
                          Sold on {new Date(item.soldAt).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="card-footer" style={{ justifyContent: 'space-between' }}>
                        <div className="price">
                          <span className="price-currency">CAD</span> {formatPrice(item.price)}
                        </div>

                        {item.sellerReviewSubmitted ? (
                          <button className="btn btn-sm btn-secondary" disabled>
                            Reviewed
                          </button>
                        ) : (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() =>
                              navigate('/trade-review', {
                                state: {
                                  transactionItemId: item.transactionItemId,
                                  direction: 'SELLER_TO_BUYER',
                                  title: item.title,
                                  targetName: item.buyerName || 'Buyer',
                                  fromTab: 'sold'
                                }
                              })
                            }
                          >
                            Review Buyer
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : tab === 'drafts' ? (
              <ul className="product-list">
                {drafts.length === 0 ? (
                  <li style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>
                    No drafts yet
                  </li>
                ) : (
                  drafts.map((item) => (
                    <li key={item.id} className="product-item product-item-draft">
                      <div>
                        <strong>{item.title || 'Untitled Draft'}</strong>
                        <div className="draft-profile-meta">
                          <span>{item.price ? formatPrice(item.price) : 'No price'}</span>
                          <span>{item.category || 'No category'}</span>
                          <span>{formatDraftUpdatedAt(item.updatedAt)}</span>
                        </div>
                      </div>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => navigate(`/?draft=${encodeURIComponent(item.id)}`)}
                        type="button"
                      >
                        Continue Editing
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : tab === 'reviews' ? (
              <div>
                <h3 style={{ marginBottom: '16px' }}>Received Reviews</h3>
                {reviews.received.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                    No one has reviewed you yet.
                  </p>
                ) : (
                  reviews.received.map((review) => (
                    <div key={`received-${review.id}`} className="card" style={{ marginBottom: '16px' }}>
                      <div className="card-body">
                        <div className="card-badges">
                          <span className="badge badge-primary">{'★'.repeat(review.rating)}</span>
                          <span className="badge badge-success">
                            {review.direction === 'BUYER_TO_SELLER' ? 'Buyer → Seller' : 'Seller → Buyer'}
                          </span>
                        </div>
                        <h3>{review.title || 'Reviewed item'}</h3>
                        <p>From: {review.reviewerName || 'Unknown user'}</p>
                        <div className="card-meta">
                          {review.comment || 'No comment provided.'}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                <h3 style={{ margin: '24px 0 16px' }}>Given Reviews</h3>
                {reviews.given.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>
                    You have not written any reviews yet.
                  </p>
                ) : (
                  reviews.given.map((review) => (
                    <div key={`given-${review.id}`} className="card" style={{ marginBottom: '16px' }}>
                      <div className="card-body">
                        <div className="card-badges">
                          <span className="badge badge-primary">{'★'.repeat(review.rating)}</span>
                          <span className="badge badge-warning">
                            {review.direction === 'BUYER_TO_SELLER' ? 'You reviewed seller' : 'You reviewed buyer'}
                          </span>
                        </div>
                        <h3>{review.title || 'Reviewed item'}</h3>
                        <p>To: {review.revieweeName || 'Unknown user'}</p>
                        <div className="card-meta">
                          {review.comment || 'No comment provided.'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <ul className="product-list">
                {favorites.length === 0 ? (
                  <li style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>
                    No favorites yet
                  </li>
                ) : (
                  favorites.map((item) => (
                    <li key={item.id} style={{ listStyle: 'none', marginBottom: '16px' }}>
                      <ProductCard
                        item={item}
                        onFavoriteChange={handleFavoriteChange}
                      />
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}