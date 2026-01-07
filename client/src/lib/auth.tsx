import * as React from 'react';
import { authApi } from './api';
import { useTranslation } from 'react-i18next';

interface User {
  id: string;
  username: string;
  email?: string;
  fullName?: string;
  bio?: string;
  avatarUrl?: string;
  accessLevel?: string;
  language?: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (username: string, password: string, email?: string, fullName?: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  isLoading: boolean;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = React.useState<User | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const { i18n } = useTranslation();

  // Check if user is already logged in (from localStorage)
  React.useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        // Set language from user preference if available
        if (parsedUser.language) {
          i18n.changeLanguage(parsedUser.language);
        }
      } catch (e) {
        // If there's an error parsing, remove the invalid data
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
      }
    }
    
    setIsLoading(false);
  }, [i18n]);

  const login = async (username: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await authApi.login(username, password);

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        return { success: true };
      } else {
        // Try to get error message from response
        const errorData = await response.json().catch(() => ({}));
        return { success: false, message: errorData.error || 'Invalid username or password' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'An error occurred during login' };
    }
  };

  const register = async (username: string, password: string, email?: string, fullName?: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await authApi.register(username, password, email, fullName);

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        return { success: true };
      } else {
        // Try to get error message from response
        const errorData = await response.json().catch(() => ({}));
        return { success: false, message: errorData.error || 'Registration failed. Please try again.' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'An error occurred during registration' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
  };

  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setUser(null);
        return null;
      }
      
      const response = await fetch('/api/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        localStorage.setItem('userData', JSON.stringify(userData));
        return userData;
      } else {
        // If token is invalid, log the user out
        logout();
        return null;
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
      return null;
    }
  };

  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    isLoading,
    refreshUser
  };

  return React.createElement(
    AuthContext.Provider,
    { value },
    children
  );
}

export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}