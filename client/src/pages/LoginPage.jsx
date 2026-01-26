import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState({ show: false, message: '', isError: true });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setNotice({ show: true, message: 'Please enter your email and password.', isError: true });
      return;
    }

    setLoading(true);
    
    try {
      const data = await api.login(email, password);
      login(data.user);
      setNotice({ show: true, message: 'Login successful! Redirecting...', isError: false });
      
      setTimeout(() => {
        navigate(data.user.role === 'admin' ? '/admin' : '/');
      }, 500);
    } catch (error) {
      setNotice({ show: true, message: error.message || 'Invalid credentials. Try again.', isError: true });
      setLoading(false);
    }
  };

  return (
    <>
      <Header showSearch={false} subtitle="Sign in to continue" />

      <section className="form-container">
        <h2>Welcome back</h2>
        <p>Sign in to access your account and start shopping.</p>

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
            <label htmlFor="loginEmail">Email address</label>
            <input 
              id="loginEmail"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="loginPassword">Password</label>
            <input 
              id="loginPassword"
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
                Signing in...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                  <polyline points="10 17 15 12 10 7"></polyline>
                  <line x1="15" y1="12" x2="3" y2="12"></line>
                </svg>
                Sign in
              </>
            )}
          </button>
        </form>

        <p className="form-footer">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </section>
    </>
  );
}
