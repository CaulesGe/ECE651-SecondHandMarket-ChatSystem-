import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { api, formatPrice } from '../utils/api';

export default function ProfilePage() {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    address: '',
    email: user.email || '',
    phone: '',
    gender: '',
  });

  const [tab, setTab] = useState('purchased');
  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);

  // Demo products - in a real app, these would come from the API
  const products = {
    purchased: [
      { id: 1, name: 'Used iPhone', price: 300 },
      { id: 2, name: 'Textbook', price: 20 },
    ],
    selling: [{ id: 3, name: 'Mechanical Keyboard', price: 80 }],
    sold: [{ id: 4, name: 'Monitor', price: 120 }],
  };

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    // In a real app, this would call an API to save the profile
    alert('Profile saved!');
  };

  useEffect(() => {
    if (!isLoggedIn) return;

    const fetchDrafts = async () => {
      setDraftsLoading(true);
      try {
        const response = await api.getDrafts(user);
        setDrafts(response.items || []);
      } catch (error) {
        console.error('Failed to load drafts on profile page:', error);
      } finally {
        setDraftsLoading(false);
      }
    };

    fetchDrafts();
  }, [isLoggedIn, user.id]);

  if (!isLoggedIn) {
    navigate('/login');
    return null;
  }

  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const currentList = tab === 'drafts' ? drafts : products[tab];
  const formatDraftUpdatedAt = (value) => {
    if (!value) return 'Just now';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Just now';
    return date.toLocaleString();
  };

  return (
    <>
      <Header showSearch={false} subtitle="Manage your profile" />

      <div className="profile-page">
        <h1 style={{ marginBottom: '30px' }}>My Profile</h1>

        <div className="profile-layout">
          {/* Left side - Profile Info */}
          <div className="profile-card">
            <div className="avatar">{initials}</div>
            <div className="username">{user.name || 'User'}</div>

            <h2>Personal Information</h2>

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
                onChange={handleChange}
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
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>

            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSave}>
              Save
            </button>
          </div>

          {/* Right side - Products */}
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
            </div>

            <ul className="product-list">
              {tab === 'drafts' && draftsLoading ? (
                <li style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>
                  Loading drafts...
                </li>
              ) : currentList.length === 0 ? (
                <li style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>
                  No items in this category
                </li>
              ) : (
                currentList.map((item) => {
                  if (tab === 'drafts') {
                    return (
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
                    );
                  }

                  return (
                    <li key={item.id} className="product-item">
                      <span>
                        {item.name} — ${item.price}
                      </span>
                      <span className={`badge badge-${tab === 'purchased' ? 'success' : tab === 'selling' ? 'primary' : 'warning'}`}>
                        {tab}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
