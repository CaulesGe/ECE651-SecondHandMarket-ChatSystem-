import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    address: '',
    email: user.email || '',
    phone: '',
    gender: '',
  });

  const [tab, setTab] = useState('purchased');

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

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!isLoggedIn) {
    navigate('/login');
    return null;
  }

  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

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
            </div>

            <ul className="product-list">
              {products[tab].length === 0 ? (
                <li style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>
                  No items in this category
                </li>
              ) : (
                products[tab].map((item) => (
                  <li key={item.id} className="product-item">
                    <span>
                      {item.name} — ${item.price}
                    </span>
                    <span className={`badge badge-${tab === 'purchased' ? 'success' : tab === 'selling' ? 'primary' : 'warning'}`}>
                      {tab}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
