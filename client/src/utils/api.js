const API_BASE = '/api';
const CHAT_BASE = '/api/chat';
const CHAT_MEDIA_MAX_SIZE_BYTES = 100 * 1024 * 1024;

const getAuthHeaders = (user) => ({
  'Content-Type': 'application/json',
  ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
  'x-user-id': user?.id || '',
  'x-user-role': user?.role || '',
  'x-user-name': user?.name || '',
  'x-user-email': user?.email || ''
});

export const api = {
  // Auth
  async login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(data.message || 'Login failed');
      err.code = data.code;
      throw err;
    }

    // Backward compatible shape: LoginPage uses data.user.
    if (data?.user && data?.token) {
      data.user = { ...data.user, token: data.token };
    }
    return data;
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

  async uploadGoodImage(file, user) {
    if (!(file instanceof File)) {
      throw new Error('Image file is required');
    }

    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch(`${API_BASE}/goods/upload-image`, {
      method: 'POST',
      headers: {
        'x-user-id': user.id,
        'x-user-role': user.role,
        'x-user-name': user.name || 'Seller'
      },
      body: formData
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Unable to upload image');
    return data;
  },

  async createGood(payload, user) {
    const res = await fetch(`${API_BASE}/goods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user.id,
        'x-user-role': user.role,
        'x-user-name': user.name || 'Seller'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Unable to list item');
    return data;
  },

  async getDrafts(user) {
    const res = await fetch(`${API_BASE}/drafts`, {
      headers: {
        'x-user-id': user.id,
        'x-user-role': user.role
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Unable to load drafts');
    return data;
  },

  async saveDraft(payload, user) {
    const res = await fetch(`${API_BASE}/drafts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user.id,
        'x-user-role': user.role
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Unable to save draft');
    return data;
  },

  async deleteDraft(id, user) {
    const res = await fetch(`${API_BASE}/drafts/${id}`, {
      method: 'DELETE',
      headers: {
        'x-user-id': user.id,
        'x-user-role': user.role
      }
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Unable to delete draft');
    }
    return true;
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
  },

  // Chat
  async createConversation(otherUserId, context = {}, user) {
    const res = await fetch(`${CHAT_BASE}/conversations`, {
      method: 'POST',
      headers: getAuthHeaders(user),
      body: JSON.stringify({
        otherUserId,
        contextOrderId: context.contextOrderId,
        contextItemId: context.contextItemId
      })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to create conversation');
    }
    return res.json();
  },

  async getConversations(user) {
    const res = await fetch(`${CHAT_BASE}/conversations`, {
      headers: getAuthHeaders(user)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to load conversations');
    }
    return res.json();
  },

  async sendMessage(conversationId, type, content, mediaObjectKey, clientMessageId, user) {
    const res = await fetch(`${CHAT_BASE}/messages`, {
      method: 'POST',
      headers: getAuthHeaders(user),
      body: JSON.stringify({ conversationId, type, content, mediaObjectKey, clientMessageId })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to send message');
    }
    return res.json();
  },

  async presignChatUpload(conversationId, mimeType, size, extension, user) {
    if (!conversationId || !mimeType) {
      throw new Error('conversationId and mimeType are required');
    }
    const numericSize = Number(size);
    if (!Number.isFinite(numericSize) || numericSize <= 0) {
      throw new Error('Invalid media size');
    }
    if (numericSize > CHAT_MEDIA_MAX_SIZE_BYTES) {
      throw new Error('Media size exceeds 100MB limit');
    }

    const res = await fetch(`${CHAT_BASE}/media/presign-upload`, {
      method: 'POST',
      headers: getAuthHeaders(user),
      body: JSON.stringify({ conversationId, mimeType, size: numericSize, extension })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to get upload URL');
    }
    return res.json();
  },

  async signChatDownload(key, user) {
    if (!key) throw new Error('Media key is required');
    const params = new URLSearchParams({ key });
    const res = await fetch(`${CHAT_BASE}/media/sign-download?${params}`, {
      headers: getAuthHeaders(user)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to sign download URL');
    }
    return res.json();
  },

  async getMessages(conversationId, afterMessageId = '', user, limit = 100, beforeMessageId = '') {
    const params = new URLSearchParams();
    if (conversationId) params.append('conversationId', conversationId);
    if (afterMessageId) params.append('afterMessageId', afterMessageId);
    if (beforeMessageId) params.append('beforeMessageId', beforeMessageId);
    if (limit) params.append('limit', String(limit));

    const res = await fetch(`${CHAT_BASE}/messages?${params}`, {
      headers: getAuthHeaders(user)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to load messages');
    }
    return res.json();
  },

  async withdrawMessage(messageId, user) {
    if (!messageId) throw new Error('messageId is required');
    const res = await fetch(`${CHAT_BASE}/messages/${messageId}/withdraw`, {
      method: 'POST',
      headers: getAuthHeaders(user)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to withdraw message');
    }
    return res.json();
  },

  async markAsRead(conversationId, messageId, user) {
    const res = await fetch(`${CHAT_BASE}/conversations/${conversationId}/read`, {
      method: 'POST',
      headers: getAuthHeaders(user),
      body: JSON.stringify({ lastReadMessageId: messageId || null })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to mark conversation as read');
    }
    return res.json();
  },
  async verifyEmail(token, signal) {
    const res = await fetch(`${API_BASE}/auth/verify?token=${encodeURIComponent(token)}`, { signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Email verification failed");
    return data;
  },


  async resendVerification(email) {
    const res = await fetch(`${API_BASE}/auth/resend-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to resend verification email");
    return data;
  },

};

export const formatPrice = (value) => `$${Number(value).toFixed(2)}`;
