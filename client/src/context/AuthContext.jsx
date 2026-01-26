import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('secondhand_user');
    return saved ? JSON.parse(saved) : { role: 'guest' };
  });

  const login = (userData) => {
    localStorage.setItem('secondhand_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('secondhand_user');
    localStorage.removeItem('secondhand_cart');
    setUser({ role: 'guest' });
  };

  const isLoggedIn = user.role !== 'guest';
  const isAdmin = user.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoggedIn, isAdmin }}>
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
