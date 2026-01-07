import { Mail, Phone } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-card">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center gap-6">
          {/* Copyright */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} reader.market
            </p>
          </div>

          {/* Contact Links */}
          <div className="flex flex-wrap justify-center gap-3">
            <a 
              href="mailto:rodion89@list.ru?subject=Йо!" 
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-muted rounded-md hover:bg-accent transition-colors"
              title="Email"
            >
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">Email</span>
            </a>
            <a 
              href="tel:+79264769929" 
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-muted rounded-md hover:bg-accent transition-colors"
              title="Phone"
            >
              <Phone className="w-4 h-4" />
              <span className="hidden sm:inline">Phone</span>
            </a>
            <a 
              href="https://t.me/WizardJIOCb" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-muted rounded-md hover:bg-accent transition-colors"
              title="Telegram"
            >
              <i className="fab fa-telegram"></i>
              <span className="hidden sm:inline">Telegram</span>
            </a>
            <a 
              href="https://wa.me/79264769929" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-muted rounded-md hover:bg-accent transition-colors"
              title="WhatsApp"
            >
              <i className="fab fa-whatsapp"></i>
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
            <a 
              href="https://vk.com/wjiocb" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-muted rounded-md hover:bg-accent transition-colors"
              title="VK"
            >
              <i className="fab fa-vk"></i>
              <span className="hidden sm:inline">VK</span>
            </a>
            <a 
              href="https://x.com/JIOCuK" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-muted rounded-md hover:bg-accent transition-colors"
              title="Twitter"
            >
              <i className="fab fa-twitter"></i>
              <span className="hidden sm:inline">Twitter</span>
            </a>
            <a 
              href="https://kick.com/wizardjiocb" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-muted rounded-md hover:bg-accent transition-colors"
              title="Kick"
            >
              <i className="fas fa-gamepad"></i>
              <span className="hidden sm:inline">Kick</span>
            </a>
            <a 
              href="https://github.com/WizardJIOCb" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-muted rounded-md hover:bg-accent transition-colors"
              title="GitHub"
            >
              <i className="fab fa-github"></i>
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
