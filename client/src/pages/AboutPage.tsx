import React from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { useTranslation } from 'react-i18next';
import { 
  BookOpen, 
  Brain, 
  Zap, 
  Globe,
  Star,
  MessageSquare,
  Search,
  Users
} from 'lucide-react';

const AboutPage = () => {
  const { user } = useAuth();
  const { t } = useTranslation(['about', 'common']);
  
  const features = [
    {
      icon: <Brain className="w-8 h-8" />,
      title: t('about:aiReading'),
      description: t('about:aiReadingDesc')
    },
    {
      icon: <BookOpen className="w-8 h-8" />,
      title: t('about:bookManagement'),
      description: t('about:bookManagementDesc')
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: t('about:fastLocal'),
      description: t('about:fastLocalDesc')
    },
    {
      icon: <Globe className="w-8 h-8" />,
      title: t('about:multipleFormats'),
      description: t('about:multipleFormatsDesc')
    },
    {
      icon: <MessageSquare className="w-8 h-8" />,
      title: t('about:community'),
      description: t('about:communityDesc')
    },
    {
      icon: <Star className="w-8 h-8" />,
      title: t('about:personalized'),
      description: t('about:personalizedDesc')
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Hero Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 font-serif">
            {t('about:heroTitle')}
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            {t('about:heroDescription')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="px-8 py-6 text-lg">
                {t('about:getStarted')}
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="px-8 py-6 text-lg">
                {t('about:signIn')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Highlights Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-serif">{t('about:featuresTitle')}</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('about:featuresSubtitle')}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="h-full">
                <CardHeader>
                  <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center text-primary mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Registration Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="py-12 px-6 md:px-12 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 font-serif">{t('about:ctaTitle')}</h2>
              <p className="text-xl mb-8 max-w-2xl mx-auto">
                {t('about:ctaDescription')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register">
                  <Button size="lg" variant="secondary" className="px-8 py-6 text-lg">
                    {t('about:createAccount')}
                  </Button>
                </Link>
                {user && (
                  <Link href="/home">
                    <Button size="lg" variant="outline" className="px-8 py-6 text-lg text-primary-foreground border-primary-foreground hover:bg-primary/10">
                      {t('about:browseBooks')}
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-serif">{t('about:contactTitle')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('about:contactSubtitle')}
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <div className="social-grid flex flex-wrap justify-center gap-4">
              <a href="mailto:rodion89@list.ru?subject=Йо!" className="social-link flex flex-col items-center justify-center p-4 bg-card rounded-lg border hover:bg-accent transition-colors w-32" title="Email">
                <i className="fas fa-envelope text-2xl mb-2"></i>
                <span>Email</span>
              </a>
              <a href="tel:+79264769929" className="social-link flex flex-col items-center justify-center p-4 bg-card rounded-lg border hover:bg-accent transition-colors w-32" title={t('about:phone')}>
                <i className="fas fa-phone text-2xl mb-2"></i>
                <span>{t('about:phone')}</span>
              </a>
              <a href="https://t.me/WizardJIOCb" target="_blank" className="social-link flex flex-col items-center justify-center p-4 bg-card rounded-lg border hover:bg-accent transition-colors w-32" title="Telegram" rel="noopener">
                <i className="fab fa-telegram text-2xl mb-2"></i>
                <span>Telegram</span>
              </a>
              <a href="https://wa.me/79264769929" target="_blank" className="social-link flex flex-col items-center justify-center p-4 bg-card rounded-lg border hover:bg-accent transition-colors w-32" title="WhatsApp" rel="noopener">
                <i className="fab fa-whatsapp text-2xl mb-2"></i>
                <span>WhatsApp</span>
              </a>
              <a href="https://vk.com/wjiocb" target="_blank" className="social-link flex flex-col items-center justify-center p-4 bg-card rounded-lg border hover:bg-accent transition-colors w-32" title="VK" rel="noopener">
                <i className="fab fa-vk text-2xl mb-2"></i>
                <span>VK</span>
              </a>
              <a href="https://x.com/JIOCuK" target="_blank" className="social-link flex flex-col items-center justify-center p-4 bg-card rounded-lg border hover:bg-accent transition-colors w-32" title="X (Twitter)" rel="noopener">
                <i className="fab fa-twitter text-2xl mb-2"></i>
                <span>Twitter</span>
              </a>
              <a href="https://kick.com/wizardjiocb" target="_blank" className="social-link flex flex-col items-center justify-center p-4 bg-card rounded-lg border hover:bg-accent transition-colors w-32" title="Kick" rel="noopener">
                <i className="fas fa-gamepad text-2xl mb-2"></i>
                <span>Kick</span>
              </a>
              <a href="https://github.com/WizardJIOCb" target="_blank" className="social-link flex flex-col items-center justify-center p-4 bg-card rounded-lg border hover:bg-accent transition-colors w-32" title="GitHub" rel="noopener">
                <img src="https://static.tildacdn.com/tild6437-3531-4032-a331-626538326631/github-logo.png" style={{ width: '24px', backgroundColor: 'white' }} className="mb-2" />
                <span>GitHub</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};



export default AboutPage;