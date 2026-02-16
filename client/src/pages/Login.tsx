import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { linkifyText } from '@/lib/linkify';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useTranslation(['auth']);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const result = await login(username, password);
    if (result.success) {
      navigate('/home');
    } else {
      setError(result.message || t('auth:invalidCredentials'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md p-6">
        <div className="flex flex-col items-center text-center">
          <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center text-primary mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
              <path d="M15.5 14.5 12 12l-3.5 2.5" />
              <path d="M9 8h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z" />
              <path d="M12 15v-3" />
            </svg>
          </div>
          
          <CardHeader className="text-center p-0 mb-6">
            <CardTitle className="text-2xl font-bold font-serif">{t('auth:signIn')}</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">{t('auth:welcomeBack')}</CardDescription>
          </CardHeader>
          
          <CardContent className="w-full p-0">
            {error && (
              <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {linkifyText(error)}
              </div>
            )}
            
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('auth:username')}
                />
              </div>
              
              <div className="space-y-2">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth:password')}
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full mt-4"
              >
                {t('auth:signInButton')}
              </Button>
            </form>
            
            <SocialLoginButtons />
            
            <div className="mt-4 text-center text-sm text-muted-foreground">
              {t('auth:noAccount')}{' '}
              <Link href="/register" className="font-medium text-primary hover:underline">
                {t('auth:registerHere')}
              </Link>
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}