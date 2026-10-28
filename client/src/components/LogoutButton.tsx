import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { useLocation } from 'wouter';

export function LogoutButton() {
  const { logout } = useAuth();
  const [, navigate] = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleLogout}
      className="w-full sm:w-auto"
    >
      Выйти из аккаунта
    </Button>
  );
}