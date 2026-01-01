import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
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
      title: "Concise Chapter Summaries",
      description: "Get AI-generated summaries of each chapter to quickly grasp key concepts."
    },
    {
      icon: <Brain className="w-8 h-8" />,
      title: "Key Ideas & Insights",
      description: "Extract important concepts and insights from your books automatically."
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Understand Complex Books Faster",
      description: "AI assistance helps you comprehend difficult material more efficiently."
    },
    {
      icon: <BookOpen className="w-8 h-8" />,
      title: "Personalized Recommendations",
      description: "Receive book suggestions based on your reading history and preferences."
    }
  ];

  const targetAudience = [
    "Non-fiction readers",
    "Students and lifelong learners",
    "Professionals who read to grow",
    "People who want to remember what they read"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Hero Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 font-serif">
            {isEarlyAdopter ? 'An AI reading tool for people who care about understanding books' : 'AI-Powered Reading Experience'}
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto">
            {isEarlyAdopter 
              ? 'Early-stage AI-powered reader. Upload your books, explore summaries and insights, and help shape the future of smart reading.'
              : 'Enhance your reading journey with intelligent summaries, insights, and personalized recommendations powered by advanced AI technology.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="px-8 py-6 text-lg">
                {isEarlyAdopter ? 'Join early access' : 'Get started — free'}
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
                See how it works
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-serif">How It Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Four simple steps to enhance your reading experience
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <Card className="h-full text-center">
              <CardHeader>
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                  <Brain className="w-8 h-8" />
                </div>
                <CardTitle className="text-xl">Read with AI assistance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Get summaries, key ideas, and explanations as you read.</p>
              </CardContent>
            </Card>
            
            <Card className="h-full text-center">
              <CardHeader>
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                  <Search className="w-8 h-8" />
                </div>
                <CardTitle className="text-xl">Search available books</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Find books already in our community library.</p>
              </CardContent>
            </Card>
            
            <Card className="h-full text-center">
              <CardHeader>
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                  <BookOpen className="w-8 h-8" />
                </div>
                <CardTitle className="text-xl">Upload your book</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Add your own books to your personal library (multiple formats supported).</p>
              </CardContent>
            </Card>
            
            <Card className="h-full text-center">
              <CardHeader>
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                  <Zap className="w-8 h-8" />
                </div>
                <CardTitle className="text-xl">Remember more & discover next reads</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Save insights and get recommendations based on what you actually read.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* AI Capabilities Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-serif">What AI Helps You Do</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Powerful AI features to enhance your reading experience
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-serif">Why Reader.market</h2>
            <p className="text-xl text-muted-foreground">
              Built specifically for understanding and retention
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Built for understanding, not just reading pages</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Focus on comprehension and retention rather than just completing books.</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Your personal library</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Upload, manage and analyze your own books, shelves, articles, etc</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Privacy-first, fast AI processing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Your books are processed securely with respect for your privacy.</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Ideal for non-fiction and deep reading</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Designed specifically for content that requires comprehension and analysis.</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Live Discussions & Community</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Join live discussions about books with other readers and share insights in real-time.</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Book Ratings & Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Rate books you've read and access community ratings to discover quality content.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Target Audience Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-serif">Who It Is For</h2>
            <p className="text-xl text-muted-foreground">
              Perfect for readers who want to maximize their learning
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
          <h2 className="text-3xl md:text-4xl font-bold mb-4 font-serif">Formats & Roadmap</h2>
          
          <div className="mb-8">
            <h3 className="text-2xl font-semibold mb-4">Currently Supported</h3>
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
            <h3 className="text-2xl font-semibold mb-4">Coming Soon</h3>
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
                Reader.market is an early-stage product. We actively develop it and shape new features based on user feedback.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 font-serif">{isEarlyAdopter ? 'Join our early adopter community. Transform your reading with AI.' : 'Start reading smarter. Turn books into knowledge with AI.'}</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Join thousands of readers who are already enjoying AI-enhanced book experiences
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" variant="secondary" className="px-8 py-6 text-lg">
                {isEarlyAdopter ? 'Join early access' : 'Get started — free'}
              </Button>
            </Link>
            {user && (
              <Link href="/home">
                <Button size="lg" variant="outline" className="px-8 py-6 text-lg text-primary-foreground border-primary-foreground hover:bg-primary-foreground/10">
                  Browse Books
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