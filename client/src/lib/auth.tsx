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
        
        // Verify user status with backend to check if they're blocked
        fetch('/api/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }).then(async (response) => {
          if (response.ok) {
            const freshUserData = await response.json();
            
            // Check if user is now blocked
            if (freshUserData.isBlocked) {
              // Log out the user immediately
              localStorage.removeItem('authToken');
              localStorage.removeItem('userData');
              setUser(null);
              setIsLoading(false);
              return;
            }
            
            setUser(freshUserData);
            localStorage.setItem('userData', JSON.stringify(freshUserData));
            
            // Check if URL has lang parameter - it takes priority
            const urlParams = new URLSearchParams(window.location.search);
            const urlLang = urlParams.get('lang');
            
            // Get currently selected language from localStorage
            const currentlySelectedLanguage = localStorage.getItem('i18nextLng');
            
            // Set language from user preference if available
            if (!urlLang && freshUserData.language) {
              if (!currentlySelectedLanguage || currentlySelectedLanguage === freshUserData.language) {
                
                i18n.changeLanguage(freshUserData.language);
                localStorage.setItem('i18nextLng', freshUserData.language);
              } else {
                
              }
            } else if (!urlLang) {
              const detectedLanguage = i18n.language || 'en';
              
            } else {
              
            }
          } else {
            // If token is invalid, log the user out
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
            setUser(null);
          }
          setIsLoading(false);
        }).catch((e) => {
          console.error('AuthProvider: Error verifying user status:', e);
          // On network error, still set user from cached data
          setUser(parsedUser);
          setIsLoading(false);
        });
      } catch (e) {
        // If there's an error parsing, remove the invalid data
        console.error('AuthProvider: Error parsing user data:', e);
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
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
        
        // If user is blocked (403 status), return the block reason
        if (response.status === 403 && errorData.blockReason) {
          return { success: false, message: errorData.blockReason };
        }
        
        return { success: false, message: errorData.error || 'Invalid username or password' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'An error occurred during login' };
    }
  };

  const register = async (username: string, password: string, email?: string, fullName?: string): Promise<{ success: boolean; message?: string }> => {
    try {
      // Get current language from i18n
      const currentLanguage = i18n.language;
      
      const response = await authApi.register(username, password, email, fullName, currentLanguage);

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        
        // Ensure language stays as selected during registration
        if (data.user.language) {
          await i18n.changeLanguage(data.user.language);
          localStorage.setItem('i18nextLng', data.user.language);
        }
        
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
        
        // Sync language with user preference
        if (userData.language) {
          
          await i18n.changeLanguage(userData.language);
          localStorage.setItem('i18nextLng', userData.language);
        }
        
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