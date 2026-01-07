import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { useTranslation } from 'react-i18next';
import NewsBlock from '@/components/NewsBlock';
import { 
  BookOpen, 
  Brain, 
  Zap, 
  FileText,
  Users,
  GraduationCap,
  Search
} from 'lucide-react';

const LandingPage = () => {
  const { user } = useAuth();
  const [location] = useLocation();
  const [isEarlyAdopter, setIsEarlyAdopter] = useState(false);
  const { t } = useTranslation(['landing', 'common']);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1]);
    setIsEarlyAdopter(location.includes('/early') || urlParams.get('early') === '1');
    
    // Handle scrolling to section if hash is present in URL
    if (location.includes('#how-it-works')) {
      setTimeout(() => {
        const element = document.getElementById('how-it-works');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, [location]);
  
  const features = [
    {
      icon: <FileText className="w-8 h-8" />,
      title: t('landing:feature1Title'),
      description: t('landing:feature1Description')
    },
    {
      icon: <Brain className="w-8 h-8" />,
      title: t('landing:feature2Title'),
      description: t('landing:feature2Description')
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: t('landing:feature3Title'),
      description: t('landing:feature3Description')
    },
    {
      icon: <BookOpen className="w-8 h-8" />,
      title: t('landing:feature4Title'),
      description: t('landing:feature4Description')
    }
  ];

  const targetAudience = [
    t('landing:audience1'),
    t('landing:audience2'),
    t('landing:audience3'),
    t('landing:audience4')
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Hero Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 font-serif">
            {isEarlyAdopter ? t('landing:heroTitleEarly') : t('landing:heroTitle')}
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto">
            {isEarlyAdopter 
              ? t('landing:heroDescriptionEarly')
              : t('landing:heroDescription')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="px-8 py-6 text-lg">
                {isEarlyAdopter ? t('landing:joinEarlyAccess') : t('landing:getStarted')}
              </Button>
            </Link>
            <a href="#how-it-works" onClick={(e) => {
              e.preventDefault();
              const element = document.getElementById('how-it-works');
              if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
              }
            }}>
              <Button size="lg" variant="outline" className="px-8 py-6 text-lg">
                {t('landing:seeHowItWorks')}
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* News Section */}
      <NewsBlock />

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-serif">{t('landing:howItWorksTitle')}</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('landing:howItWorksSubtitle')}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <Card className="h-full text-center">
              <CardHeader>
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                  <Brain className="w-8 h-8" />
                </div>
                <CardTitle className="text-xl">{t('landing:step1Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t('landing:step1Description')}</p>
              </CardContent>
            </Card>
            
            <Card className="h-full text-center">
              <CardHeader>
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                  <Search className="w-8 h-8" />
                </div>
                <CardTitle className="text-xl">{t('landing:step2Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t('landing:step2Description')}</p>
              </CardContent>
            </Card>
            
            <Card className="h-full text-center">
              <CardHeader>
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                  <BookOpen className="w-8 h-8" />
                </div>
                <CardTitle className="text-xl">{t('landing:step3Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t('landing:step3Description')}</p>
              </CardContent>
            </Card>
            
            <Card className="h-full text-center">
              <CardHeader>
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                  <Zap className="w-8 h-8" />
                </div>
                <CardTitle className="text-xl">{t('landing:step4Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t('landing:step4Description')}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* AI Capabilities Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-serif">{t('landing:aiHelpsTitle')}</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('landing:aiHelpsSubtitle')}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
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

      {/* Value Proposition Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-serif">{t('landing:whyReaderMarketTitle')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('landing:whyReaderMarketSubtitle')}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>{t('landing:benefit1Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t('landing:benefit1Description')}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>{t('landing:benefit2Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t('landing:benefit2Description')}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>{t('landing:benefit3Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t('landing:benefit3Description')}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>{t('landing:benefit4Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t('landing:benefit4Description')}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>{t('landing:benefit5Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t('landing:benefit5Description')}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>{t('landing:benefit6Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t('landing:benefit6Description')}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Target Audience Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-serif">{t('landing:whoIsItForTitle')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('landing:whoIsItForSubtitle')}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {targetAudience.map((audience, index) => (
              <Card key={index} className="h-full">
                <CardContent className="flex items-center p-6">
                  <Users className="w-6 h-6 mr-4 text-primary flex-shrink-0" />
                  <span className="text-lg">{audience}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Format Support Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 font-serif">{t('landing:formatsTitle')}</h2>
          
          <div className="mb-8">
            <h3 className="text-2xl font-semibold mb-4">{t('landing:currentlySupported')}</h3>
            <div className="flex flex-wrap justify-center gap-4">
              <div className="bg-primary/10 px-6 py-3 rounded-lg">
                <span className="text-lg font-medium">PDF</span>
              </div>
              <div className="bg-primary/10 px-6 py-3 rounded-lg">
                <span className="text-lg font-medium">DOC</span>
              </div>
              <div className="bg-primary/10 px-6 py-3 rounded-lg">
                <span className="text-lg font-medium">DOCX</span>
              </div>
              <div className="bg-primary/10 px-6 py-3 rounded-lg">
                <span className="text-lg font-medium">EPUB</span>
              </div>
              <div className="bg-primary/10 px-6 py-3 rounded-lg">
                <span className="text-lg font-medium">TXT</span>
              </div>
              <div className="bg-primary/10 px-6 py-3 rounded-lg">
                <span className="text-lg font-medium">FB2</span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-2xl font-semibold mb-4">{t('landing:comingSoon')}</h3>
            <div className="flex flex-wrap justify-center gap-4">
              <div className="bg-muted px-6 py-3 rounded-lg">
                <span className="text-lg font-medium">MOBI</span>
              </div>
              <div className="bg-muted px-6 py-3 rounded-lg">
                <span className="text-lg font-medium">AZW3</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Transparency Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <Card className="p-8">
            <CardContent className="text-center">
              <GraduationCap className="w-12 h-12 mx-auto mb-4 text-primary" />
              <p className="text-xl text-muted-foreground">
                {t('landing:transparencyMessage')}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 font-serif">{isEarlyAdopter ? t('landing:ctaTitleEarly') : t('landing:ctaTitle')}</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            {t('landing:ctaSubtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" variant="secondary" className="px-8 py-6 text-lg">
                {isEarlyAdopter ? t('landing:joinEarlyAccess') : t('landing:getStarted')}
              </Button>
            </Link>
            {user && (
              <Link href="/home">
                <Button size="lg" variant="outline" className="px-8 py-6 text-lg text-primary-foreground border-primary-foreground hover:bg-primary-foreground/10">
                  {t('landing:browseBooks')}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;