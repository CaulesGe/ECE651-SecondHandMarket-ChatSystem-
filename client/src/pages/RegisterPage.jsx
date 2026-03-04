import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repassword, setRePassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState({ show: false, message: '', isError: true });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name || !email || !password || !repassword) {
      setNotice({ show: true, message: 'Please complete all fields.', isError: true });
      return;
    }

    if (password.length < 6) {
      setNotice({ show: true, message: 'Password must be at least 6 characters.', isError: true });
      return;
    }

    if (password != repassword) {
      setNotice({ show: true, message: 'Two password does not match', isError: true });
      return;
    }

    setLoading(true);
    
    try {
      const data = await api.register(name, email, password);
      setNotice({
        show: true,
        message: data.message || "Account created. Please check your email to verify.",
        isError: false
      });

      setTimeout(() => {
        navigate("/login");
      }, 800);
    } catch (error) {
      setNotice({ show: true, message: error.message || "Unable to register.", isError: true });
      setLoading(false);
    }
  };

  return (
    <>
      <Header showSearch={false} subtitle="Create your account" />

      <section className="form-container">
        <h2>Join the marketplace</h2>
        <p>Create an account to buy, sell, and connect with your community.</p>

        {notice.show && (
          <p className={`notice ${notice.isError ? 'notice-error' : 'notice-success'}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              {notice.isError ? (
                <>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </>
              ) : (
                <polyline points="9 12 12 15 16 10"></polyline>
              )}
            </svg>
            <span>{notice.message}</span>
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="registerName">Full name</label>
            <input 
              id="registerName"
              type="text"
              placeholder="Jordan Lee"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="registerEmail">Email address</label>
            <input 
              id="registerEmail"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="registerPassword">Password</label>
            <input 
              id="registerPassword"
              type="password"
              placeholder="Create a password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="registerPassword">Confirm Password</label>
            <input 
              id="registerPassword"
              type="password"
              placeholder="Confirm the password"
              autoComplete="new-password"
              value={repassword}
              onChange={(e) => setRePassword(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spin">
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12"></circle>
                </svg>
                Creating account...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                  <line x1="20" y1="8" x2="20" y2="14"></line>
                  <line x1="23" y1="11" x2="17" y2="11"></line>
                </svg>
                Create account
              </>
            )}
          </button>
        </form>

        <p className="form-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </>
  );
}
