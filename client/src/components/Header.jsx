import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Header({ showSearch = true, subtitle = 'Buy & sell with confidence' }) {
  const { user, logout, isLoggedIn, isAdmin } = useAuth();
  const { cartCount } = useCart();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('All');

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.append('search', searchQuery);
    if (category !== 'All') params.append('category', category);
    navigate(`/?${params}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="top-nav">
      <Link to="/" className="brand">
        <div className="brand-icon">SH</div>
        <div className="brand-text">
          <h1>Secondhand Hub</h1>
          <span>{subtitle}</span>
        </div>
      </Link>

      {showSearch && (
        <form className="search-bar" onSubmit={handleSearch}>
          <select 
            className="search-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="All">All Categories</option>
            <option value="Electronics">Electronics</option>
            <option value="Furniture">Furniture</option>
            <option value="Clothing">Clothing</option>
            <option value="Sports">Sports</option>
            <option value="Books & Media">Books & Media</option>
            <option value="Home & Kitchen">Home & Kitchen</option>
            <option value="Music">Music</option>
          </select>
          <input
            type="text"
            className="search-input"
            placeholder="Search for anything..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="search-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
        </form>
      )}

      <nav className="nav-links">
        <span className="user-badge">{isLoggedIn ? user.name : 'Guest'}</span>
        
        {!isLoggedIn ? (
          <>
            <Link to="/login" className="auth-link">Login</Link>
            <Link to="/register" className="auth-link">Register</Link>
          </>
        ) : (
          <>
            {isAdmin && <Link to="/admin">Admin Panel</Link>}
            <Link to="/profile">Profile</Link>
            <button onClick={handleLogout}>Logout</button>
          </>
        )}
        
        <Link to="/" className="cart-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          <span className="cart-badge">{cartCount}</span>
        </Link>
      </nav>
    </header>
  );
}
