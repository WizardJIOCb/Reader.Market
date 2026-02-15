import { motion } from 'framer-motion';
import { BookOpen, ArrowRight, Mail, Phone, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const socialLinks = [
  { name: 'Telegram', href: 'https://t.me/WizardJIOCb', icon: MessageCircle },
  { name: 'WhatsApp', href: 'https://wa.me/79264769929', icon: Phone },
  { name: 'VK', href: 'https://vk.com/wjiocb', icon: MessageCircle },
  { name: 'Twitter', href: 'https://x.com/JIOCuK', icon: MessageCircle },
  { name: 'Kick', href: 'https://kick.com/wizardjiocb', icon: MessageCircle },
  { name: 'GitHub', href: 'https://github.com/WizardJIOCb', icon: MessageCircle },
];

const footerLinks = [
  {
    title: 'Product',
    links: [
      { name: 'Features', href: '#features' },
      { name: 'How It Works', href: '#how-it-works' },
      { name: 'Pricing', href: '#' },
      { name: 'Roadmap', href: '#collections' },
    ],
  },
  {
    title: 'Community',
    links: [
      { name: 'Books', href: '#books' },
      { name: 'Users', href: '#users' },
      { name: 'Collections', href: '#collections' },
      { name: 'Articles', href: '#' },
    ],
  },
  {
    title: 'Support',
    links: [
      { name: 'Help Center', href: '#' },
      { name: 'Contact Us', href: '#' },
      { name: 'Privacy Policy', href: '#' },
      { name: 'Terms of Service', href: '#' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden">
      {/* CTA Section */}
      <div className="relative py-24 lg:py-32">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-hero" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(ellipse at center, hsl(265 85% 60% / 0.2) 0%, transparent 70%)',
          }}
        />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              <span className="text-white">Start reading smarter.</span>
              <br />
              <span className="text-gradient">
                Turn books into knowledge with AI.
              </span>
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
              Join thousands of readers who are already enjoying AI-enhanced book experiences
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="group bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-6 text-lg rounded-xl glow-purple"
              >
                <BookOpen className="w-5 h-5 mr-2" />
                Get Started — Free
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="border-t border-white/5 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            {/* Brand */}
            <div className="lg:col-span-2">
              <motion.a
                href="#home"
                className="flex items-center gap-3 mb-6"
                whileHover={{ scale: 1.02 }}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gradient">
                  Reader.Market
                </span>
              </motion.a>
              <p className="text-muted-foreground mb-6 max-w-sm">
                An early-stage product actively developed and shaped based on user feedback.
              </p>
              
              {/* Contact */}
              <div className="flex items-center gap-4 mb-6">
                <a
                  href="mailto:contact@reader.market"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Email
                </a>
                <a
                  href="tel:+79264769929"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  Phone
                </a>
              </div>

              {/* Social Links */}
              <div className="flex flex-wrap gap-3">
                {socialLinks.map((social) => (
                  <motion.a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-10 h-10 rounded-lg bg-white/5 hover:bg-primary/20 flex items-center justify-center transition-colors"
                    title={social.name}
                  >
                    <social.icon className="w-5 h-5 text-muted-foreground hover:text-primary" />
                  </motion.a>
                ))}
              </div>
            </div>

            {/* Links */}
            {footerLinks.map((group) => (
              <div key={group.title}>
                <h4 className="text-white font-semibold mb-4">{group.title}</h4>
                <ul className="space-y-3">
                  {group.links.map((link) => (
                    <li key={link.name}>
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-white transition-colors"
                      >
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                © 2026 Reader.Market. All rights reserved.
              </p>
              <p className="text-sm text-muted-foreground">
                Made with ❤️ for book lovers
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
