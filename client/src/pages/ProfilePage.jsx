import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { api, formatPrice } from '../utils/api';
import ProductCard from '../components/ProductCard';

export default function ProfilePage() {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();

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

  const [purchased, setPurchased] = useState([]);
  const [purchasedLoading, setPurchasedLoading] = useState(false);

  const [selling, setSelling] = useState([]);
  const [sellingLoading, setSellingLoading] = useState(false);

  const [sold, setSold] = useState([]);
  const [soldLoading, setSoldLoading] = useState(false);

  const [notice, setNotice] = useState('');

  const handleChange = (e) => {
    setProfile((prev) => ({ ...prev, [e.target.name]: e.target.value }));
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
      setNotice(error.message || 'Failed to load profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const loadPurchased = async () => {
    try {
      setPurchasedLoading(true);
      const res = await api.getMyTransactions(user);
      setPurchased(res.items || []);
    } catch (error) {
      setNotice(error.message || 'Failed to load purchased items.');
    } finally {
      setPurchasedLoading(false);
    }
  };

  const loadSelling = async () => {
    try {
      setSellingLoading(true);
      const res = await api.getMyListings(user);
      setSelling(res.items || []);
    } catch (error) {
      setNotice(error.message || 'Failed to load selling items.');
    } finally {
      setSellingLoading(false);
    }
  };

  const loadSold = async () => {
    try {
      setSoldLoading(true);
      const res = await api.getMySoldListings(user);
      setSold(res.items || []);
    } catch (error) {
      setNotice(error.message || 'Failed to load sold items.');
    } finally {
      setSoldLoading(false);
    }
  };

  const loadDrafts = async () => {
    try {
      setDraftsLoading(true);
      const res = await api.getDrafts(user);
      setDrafts(res.items || []);
    } catch (error) {
      setNotice(error.message || 'Failed to load drafts.');
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
      setNotice(error.message || 'Failed to load favorites.');
    } finally {
      setFavoritesLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn || !user) return;
    loadProfile();
  }, [isLoggedIn, user]);

  useEffect(() => {
    if (!isLoggedIn || !user) return;

    if (tab === 'purchased') {
      loadPurchased();
    } else if (tab === 'selling') {
      loadSelling();
    } else if (tab === 'sold') {
      loadSold();
    } else if (tab === 'drafts') {
      loadDrafts();
    } else if (tab === 'favorites') {
      loadFavorites();
    }
  }, [tab, isLoggedIn, user]);

  const handleSave = async () => {
    try {
      setSaveLoading(true);
      setNotice('');

      const res = await api.updateProfile(
        {
          name: profile.name,
          address: profile.address,
          phone: profile.phone,
          gender: profile.gender,
        },
        user
      );

      setProfile({
        name: res.profile.name || '',
        address: res.profile.address || '',
        email: res.profile.email || '',
        phone: res.profile.phone || '',
        gender: res.profile.gender || '',
      });

      alert('Profile saved successfully.');
    } catch (error) {
      alert(error.message || 'Failed to save profile.');
    } finally {
      setSaveLoading(false);
    }
  };

  const purchasedItems = useMemo(() => {
    return purchased.flatMap((tx) =>
      (tx.items || []).map((item, index) => ({
        ...item,
        key: `${tx.id}-${item.goodsId}-${index}`,
        transactionId: tx.id,
        transactionStatus: tx.status,
        transactionCreatedAt: tx.createdAt,
      }))
    );
  }, [purchased]);

  const initials = (profile.name || user?.name || 'U')
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
    (tab === 'purchased' && purchasedLoading) ||
    (tab === 'selling' && sellingLoading) ||
    (tab === 'sold' && soldLoading) ||
    (tab === 'drafts' && draftsLoading) ||
    (tab === 'favorites' && favoritesLoading);

  return (
    <>
      <Header showSearch={false} subtitle="Manage your profile" />

      <div className="profile-page">
        <h1 style={{ marginBottom: '30px' }}>My Profile</h1>

        <div className="profile-layout">
          <div className="profile-card">
            <div className="avatar">{initials}</div>
            <div className="username">{profile.name || user.name || 'User'}</div>

            <h2>Personal Information</h2>

            {notice && (
              <p style={{ marginBottom: '12px', color: 'var(--text-muted)' }}>
                {notice}
              </p>
            )}

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
            </div>

            {isTabLoading ? (
              <ul className="product-list">
                <li style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>
                  Loading...
                </li>
              </ul>
            ) : tab === 'purchased' ? (
              <ul className="product-list">
                {purchasedItems.length === 0 ? (
                  <li style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>
                    No purchased items yet
                  </li>
                ) : (
                  purchasedItems.map((item) => (
                    <li key={item.key} className="product-item">
                      <div>
                        <div>
                          <strong>{item.title}</strong> — {formatPrice(item.price)}
                        </div>
                        <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Purchased on {new Date(item.transactionCreatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <span className="badge badge-success">
                        {item.transactionStatus}
                      </span>
                    </li>
                  ))
                )}
              </ul>
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
              sold.length === 0 ? (
                <ul className="product-list">
                  <li style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>
                    No sold items yet
                  </li>
                </ul>
              ) : (
                <div>
                  {sold.map((item) => (
                    <div key={item.id} style={{ marginBottom: '16px' }}>
                      <ProductCard item={item} />
                    </div>
                  ))}
                </div>
              )
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