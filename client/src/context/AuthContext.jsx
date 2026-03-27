import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('secondhand_user');
    return saved ? JSON.parse(saved) : { role: 'guest' };
  });

  const login = (userData) => {
    const normalizedUser = {
      ...userData,
      name: userData?.name?.trim() || ''
    };
    localStorage.setItem('secondhand_user', JSON.stringify(normalizedUser));
    setUser(normalizedUser);
  };

  const updateUser = (updates) => {
    setUser((prev) => {
      const nextUser = {
        ...prev,
        ...updates,
        name:
          typeof updates?.name === 'string'
            ? updates.name.trim()
            : prev?.name || ''
      };

      localStorage.setItem('secondhand_user', JSON.stringify(nextUser));
      return nextUser;
    });
  };

  const logout = () => {
    localStorage.removeItem('secondhand_user');
    setUser({ role: 'guest' });
  };

  const isLoggedIn = user.role !== 'guest';
  const isAdmin = user.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isLoggedIn, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
