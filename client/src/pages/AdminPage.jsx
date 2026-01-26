import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { api, formatPrice } from '../utils/api';

export default function AdminPage() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [goods, setGoods] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    try {
      const [usersRes, goodsRes, transactionsRes] = await Promise.all([
        api.getUsers(),
        api.getGoods(),
        api.getTransactions()
      ]);
      setUsers(usersRes.items || []);
      setGoods(goodsRes.items || []);
      setTransactions(transactionsRes.items || []);
    } catch (err) {
      console.error('Error loading admin data:', err);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getRolePill = (role) => {
    const pillClass = role === 'admin' ? 'pill-admin' : 'pill-user';
    return <span className={`pill ${pillClass}`}>{role}</span>;
  };

  if (!isAdmin) {
    return (
      <>
        <Header showSearch={false} subtitle="Manage your marketplace" />
        <section className="admin-grid">
          <p className="notice notice-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Admin access required. Please login as an admin user.
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      <Header showSearch={false} subtitle="Manage your marketplace" />

      <section className="admin-grid">
        {/* Stats */}
        <div className="admin-stats">
          <div className="stat-card">
            <span className="stat-value">{users.length}</span>
            <span className="stat-label">Total Users</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{goods.length}</span>
            <span className="stat-label">Active Listings</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{transactions.length}</span>
            <span className="stat-label">Transactions</span>
          </div>
        </div>

        {/* Users Table */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-3px', marginRight: '8px' }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              Registered Users
            </h3>
          </div>
          <div className="admin-card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>Loading...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No users found</td></tr>
                ) : (
                  users.map(u => (
                    <tr key={u.id}>
                      <td><strong>{u.name}</strong></td>
                      <td>{u.email}</td>
                      <td>{getRolePill(u.role)}</td>
                      <td>{formatDate(u.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Goods Table */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-3px', marginRight: '8px' }}>
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
              All Listings
            </h3>
          </div>
          <div className="admin-card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Condition</th>
                  <th>Price</th>
                  <th>Seller</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>Loading...</td></tr>
                ) : goods.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No listings found</td></tr>
                ) : (
                  goods.map(g => (
                    <tr key={g.id}>
                      <td><strong>{g.title}</strong></td>
                      <td><span className="badge badge-primary">{g.category}</span></td>
                      <td>{g.condition}</td>
                      <td><strong>{formatPrice(g.price)}</strong></td>
                      <td>{g.sellerName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-3px', marginRight: '8px' }}>
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
              Transaction History
            </h3>
          </div>
          <div className="admin-card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>User</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>Loading...</td></tr>
                ) : transactions.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No transactions found</td></tr>
                ) : (
                  transactions.map(t => (
                    <tr key={t.id}>
                      <td>
                        <code style={{ fontSize: '11px', background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px' }}>
                          {t.id}
                        </code>
                      </td>
                      <td>{t.userId}</td>
                      <td><strong>{formatPrice(t.total)}</strong></td>
                      <td><span className="pill pill-pending">{t.status}</span></td>
                      <td>{formatDate(t.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
