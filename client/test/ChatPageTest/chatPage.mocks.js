const AUTH_STORAGE_KEY = 'secondhand_user';

const DEFAULT_USER = {
  id: 'u_1001',
  role: 'user',
  name: 'Jordan Lee',
  email: 'jordan@example.com',
  token: 'fake-jwt-token'
};

const buildConversationsFromState = (state) => (
  state.conversations.map((conversation) => {
    const messages = state.messagesByConversation[conversation.id] || [];
    const lastMessage = messages[messages.length - 1] || null;
    return {
      ...conversation,
      lastMessage,
      updatedAt: lastMessage?.createdAt || conversation.updatedAt
    };
  })
);

const jsonResponse = (body, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body)
});

export const createMockChatState = () => {
  const now = Date.now();
  const iso = (deltaMs) => new Date(now + deltaMs).toISOString();

  const conversations = [
    {
      id: 'c_alpha',
      participants: [
        { userId: 'u_1001', user: { id: 'u_1001', name: 'Jordan Lee' } },
        { userId: 'u_admin', user: { id: 'u_admin', name: 'Admin' } }
      ],
      unreadCount: 0,
      updatedAt: iso(-30_000)
    },
    {
      id: 'c_beta',
      participants: [
        { userId: 'u_1001', user: { id: 'u_1001', name: 'Jordan Lee' } },
        { userId: 'u_seller', user: { id: 'u_seller', name: 'Taylor Seller' } }
      ],
      unreadCount: 1,
      updatedAt: iso(-40_000)
    }
  ];

  const messagesByConversation = {
    c_alpha: [
      {
        id: 'm_alpha_1',
        conversationId: 'c_alpha',
        senderId: 'u_admin',
        type: 'text',
        content: 'Hi Jordan',
        mediaObjectKey: null,
        isWithdrawn: false,
        createdAt: iso(-40_000)
      },
      {
        id: 'm_alpha_2',
        conversationId: 'c_alpha',
        senderId: 'u_1001',
        type: 'text',
        content: 'Hello admin',
        mediaObjectKey: null,
        isWithdrawn: false,
        createdAt: iso(-30_000)
      }
    ],
    c_beta: [
      {
        id: 'm_beta_1',
        conversationId: 'c_beta',
        senderId: 'u_seller',
        type: 'text',
        content: 'Can you pick up tomorrow?',
        mediaObjectKey: null,
        isWithdrawn: false,
        createdAt: iso(-35_000)
      }
    ]
  };

  return { conversations, messagesByConversation };
};

export const seedAuthenticatedUser = async (page, user = DEFAULT_USER) => {
  await page.addInitScript(
    ({ storageKey, userData }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(userData));
    },
    { storageKey: AUTH_STORAGE_KEY, userData: user }
  );
};

export const clearAuthenticatedUser = async (page) => {
  await page.addInitScript((storageKey) => {
    window.localStorage.removeItem(storageKey);
  }, AUTH_STORAGE_KEY);
};

export const installChatApiMocks = async (page, initialState = createMockChatState()) => {
  const state = {
    conversations: [...initialState.conversations],
    messagesByConversation: Object.fromEntries(
      Object.entries(initialState.messagesByConversation).map(([conversationId, messages]) => [
        conversationId,
        [...messages]
      ])
    ),
    nextMessageSeq: 100
  };

  await page.route('**/api/chat/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;

    if (method === 'GET' && path.endsWith('/chat/conversations')) {
      await route.fulfill(jsonResponse({ items: buildConversationsFromState(state) }));
      return;
    }

    if (method === 'GET' && path.endsWith('/chat/messages')) {
      const conversationId = url.searchParams.get('conversationId');
      if (!conversationId) {
        await route.fulfill(jsonResponse({ message: 'conversationId is required' }, 400));
        return;
      }
      const items = state.messagesByConversation[conversationId] || [];
      await route.fulfill(jsonResponse({ items }));
      return;
    }

    if (method === 'POST' && path.endsWith('/chat/messages')) {
      const payload = request.postDataJSON() || {};
      const conversationId = payload.conversationId;
      if (!conversationId || !state.messagesByConversation[conversationId]) {
        await route.fulfill(jsonResponse({ message: 'Conversation not found' }, 400));
        return;
      }
      const createdAt = new Date(Date.UTC(2026, 2, 3, 10, 2, state.nextMessageSeq)).toISOString();
      const message = {
        id: `m_generated_${state.nextMessageSeq}`,
        conversationId,
        senderId: DEFAULT_USER.id,
        type: payload.type || 'text',
        content: payload.content || '',
        mediaObjectKey: payload.mediaObjectKey || null,
        isWithdrawn: false,
        createdAt
      };
      state.nextMessageSeq += 1;
      state.messagesByConversation[conversationId] = [
        ...state.messagesByConversation[conversationId],
        message
      ];
      await route.fulfill(jsonResponse({ message }, 201));
      return;
    }

    if (method === 'POST' && path.includes('/chat/messages/') && path.endsWith('/withdraw')) {
      const messageId = path.split('/').slice(-2)[0];
      let updatedMessage = null;
      Object.keys(state.messagesByConversation).forEach((conversationId) => {
        state.messagesByConversation[conversationId] = state.messagesByConversation[conversationId].map((item) => {
          if (item.id !== messageId) return item;
          if (item.senderId !== DEFAULT_USER.id) return item;
          updatedMessage = {
            ...item,
            content: '',
            mediaObjectKey: null,
            isWithdrawn: true
          };
          return updatedMessage;
        });
      });

      if (!updatedMessage) {
        await route.fulfill(jsonResponse({ message: 'Message not found or not owned by user' }, 400));
        return;
      }

      await route.fulfill(jsonResponse({ message: updatedMessage }));
      return;
    }

    if (method === 'POST' && path.includes('/chat/conversations/') && path.endsWith('/read')) {
      await route.fulfill(jsonResponse({ state: { ok: true } }));
      return;
    }

    if (method === 'GET' && path.endsWith('/chat/media/sign-download')) {
      await route.fulfill(jsonResponse({
        downloadUrl: 'https://example.com/mock-media-download',
        expiresIn: 300
      }));
      return;
    }

    if (method === 'POST' && path.endsWith('/chat/media/presign-upload')) {
      await route.fulfill(jsonResponse({
        uploadUrl: 'https://example.com/mock-media-upload',
        objectKey: 'chat/conversations/c_alpha/users/u_1001/mock.jpg',
        expiresIn: 300
      }));
      return;
    }

    await route.fulfill(jsonResponse({ message: `Unhandled mocked endpoint: ${method} ${path}` }, 500));
  });
};

