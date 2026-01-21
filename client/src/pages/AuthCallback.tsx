import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';

export default function AuthCallback() {
  const [, navigate] = useLocation();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (error) {
      console.error('OAuth error:', error);
      navigate('/login?error=' + error);
      return;
    }

    if (token) {
      // Store token with the correct key 'authToken'
      localStorage.setItem('authToken', token);
      
      // Decode JWT to get userId
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userId = payload.userId;
        
        // Fetch user data from API
        fetch(`/api/profile/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
          .then(res => res.json())
          .then(data => {
            // Store user data
            localStorage.setItem('userData', JSON.stringify(data));
            
            // Trigger auth context update
            refreshUser();
            
            // Redirect to stream page
            navigate('/stream');
          })
          .catch(err => {
            console.error('Failed to fetch user data:', err);
            navigate('/login?error=fetch_failed');
          });
      } catch (err) {
        console.error('Failed to decode token:', err);
        navigate('/login?error=invalid_token');
      }
    } else {
      navigate('/login?error=no_token');
    }
  }, [navigate, refreshUser]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Completing authentication...</p>
      </div>
    </div>
  );
}
