const API_BASE = '/api';

export const api = {
  // Auth
  async login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Login failed');
    }
    return res.json();
  },

  async register(name, email, password) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Registration failed');
    }
    return res.json();
  },

  // Goods
  async getGoods(search = '', category = '') {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category && category !== 'All') params.append('category', category);
    const res = await fetch(`${API_BASE}/goods?${params}`);
    if (!res.ok) throw new Error('Failed to load goods');
    return res.json();
  },

  async getGood(id) {
    const res = await fetch(`${API_BASE}/goods/${id}`);
    if (!res.ok) throw new Error('Product not found');
    return res.json();
  },

  async getRecommendations(id, limit = 8) {
    const res = await fetch(`${API_BASE}/goods/${id}/recommendations?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to load recommendations');
    return res.json();
  },

  async createGood(payload, user) {
    const res = await fetch(`${API_BASE}/goods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': user.role,
        'x-user-name': user.name || 'Seller'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Unable to list item');
    return res.json();
  },

  // Categories
  async getCategories() {
    const res = await fetch(`${API_BASE}/categories`);
    if (!res.ok) throw new Error('Failed to load categories');
    return res.json();
  },

  // Transactions
  async checkout(payload, user) {
    const res = await fetch(`${API_BASE}/transactions/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': user.role
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Checkout failed');
    return res.json();
  },

  // Admin
  async getUsers() {
    const res = await fetch(`${API_BASE}/users`, {
      headers: { 'x-user-role': 'admin' }
    });
    if (!res.ok) throw new Error('Failed to load users');
    return res.json();
  },

  async getTransactions() {
    const res = await fetch(`${API_BASE}/transactions`, {
      headers: { 'x-user-role': 'admin' }
    });
    if (!res.ok) throw new Error('Failed to load transactions');
    return res.json();
  }
};

export const formatPrice = (value) => `$${Number(value).toFixed(2)}`;
