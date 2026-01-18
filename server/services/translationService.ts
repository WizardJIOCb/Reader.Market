import fetch from 'node-fetch';

interface TranslationProvider {
  name: string;
  translateText(text: string, targetLang: string, sourceLang?: string): Promise<string>;
  supportedLanguages(): string[];
}

class OllamaProvider implements TranslationProvider {
  name = 'ollama';
  private apiUrl: string;
  private model: string;
  
  constructor(apiUrl = 'http://localhost:11434', model = 'mistral:latest') {
    this.apiUrl = apiUrl;
    this.model = model;
  }
  
  async translateText(text: string, targetLang: string, sourceLang = 'en'): Promise<string> {
    const languageNames: Record<string, string> = {
      en: 'English',
      ru: 'Russian',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      zh: 'Chinese',
      ja: 'Japanese',
      ar: 'Arabic',
      pt: 'Portuguese',
      it: 'Italian',
    };

    const prompt = `Translate the following text from ${languageNames[sourceLang] || sourceLang} to ${languageNames[targetLang] || targetLang}. 
Only output the translated text, no explanations or additional comments.

Text to translate:
${text}

Translation:`;
    
    const response = await fetch(`${this.apiUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }
    
    const data = await response.json() as { response: string };
    return data.response.trim();
  }
  
  supportedLanguages(): string[] {
    return ['en', 'ru', 'es', 'fr', 'de', 'zh', 'ja', 'ar', 'pt', 'it'];
  }
  
  async listAvailableModels(): Promise<string[]> {
    try {
      // Always use CLI fallback as primary source for now due to Ollama API caching issues
      console.log('[TranslationService] Fetching models via CLI');
      const cliModels = await this.listModelsViaCLI();
      
      if (cliModels.length > 0) {
        console.log(`[TranslationService] Found ${cliModels.length} models via CLI:`, cliModels);
        return cliModels;
      }
      
      // Fallback to API if CLI fails
      console.log('[TranslationService] CLI returned no models, trying API');
      const response = await fetch(`${this.apiUrl}/api/tags?t=${Date.now()}`);
      if (!response.ok) {
        console.error('Failed to fetch Ollama models via API:', response.statusText);
        return [];
      }
      const data = await response.json() as { models: Array<{ name: string }> };
      const apiModels = data.models.map(m => m.name);
      console.log(`[TranslationService] Found ${apiModels.length} models via API:`, apiModels);
      
      return apiModels;
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error);
      return [];
    }
  }
  
  private async listModelsViaCLI(): Promise<string[]> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync('ollama list');
      const lines = stdout.trim().split('\n');
      
      // Skip header line and parse model names
      const models = lines
        .slice(1)
        .map(line => {
          const match = line.match(/^(\S+)/);
          return match ? match[1] : null;
        })
        .filter((name): name is string => name !== null);
      
      console.log(`Found ${models.length} models via CLI:`, models);
      return models;
    } catch (error) {
      console.error('Failed to list models via CLI:', error);
      return [];
    }
  }

  setModel(model: string) {
    this.model = model;
  }
}

class LibreTranslateProvider implements TranslationProvider {
  name = 'libretranslate';
  private apiUrl: string;
  private apiKey?: string;

  constructor(apiUrl: string, apiKey?: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  async translateText(text: string, targetLang: string, sourceLang = 'en'): Promise<string> {
    const body: any = {
      q: text,
      source: sourceLang,
      target: targetLang,
      format: 'text',
    };

    if (this.apiKey) {
      body.api_key = this.apiKey;
    }

    const response = await fetch(`${this.apiUrl}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`LibreTranslate API error: ${response.statusText}`);
    }

    const data = await response.json() as { translatedText: string };
    return data.translatedText;
  }

  supportedLanguages(): string[] {
    return ['en', 'ru', 'es', 'fr', 'de', 'zh', 'ja', 'ar', 'pt', 'it'];
  }
}

export class TranslationService {
  private providers: Map<string, TranslationProvider>;
  
  constructor() {
    this.providers = new Map();
    
    // Initialize Ollama as primary provider
    this.providers.set('ollama', new OllamaProvider(
      process.env.OLLAMA_API_URL || 'http://localhost:11434',
      process.env.OLLAMA_MODEL || 'mistral:latest'
    ));
    
    // Initialize backup providers if configured
    if (process.env.LIBRETRANSLATE_API_URL) {
      this.providers.set('libretranslate', new LibreTranslateProvider(
        process.env.LIBRETRANSLATE_API_URL,
        process.env.LIBRETRANSLATE_API_KEY
      ));
    }
  }
  
  getProvider(service: string, model?: string): TranslationProvider | undefined {
    const provider = this.providers.get(service);
    if (provider && service === 'ollama' && model) {
      (provider as OllamaProvider).setModel(model);
    }
    return provider;
  }
  
  async translateText(
    text: string,
    targetLanguage: string,
    service: string,
    sourceLang = 'en',
    model?: string
  ): Promise<string> {
    const provider = this.getProvider(service, model);
    if (!provider) {
      throw new Error(`Translation service '${service}' not available`);
    }
    
    return await provider.translateText(text, targetLanguage, sourceLang);
  }
  
  async getAvailableModels(): Promise<{ service: string; models: string[]; available: boolean }[]> {
    const result = [];
    
    // Get Ollama models
    const ollamaProvider = this.providers.get('ollama') as OllamaProvider;
    if (ollamaProvider) {
      const models = await ollamaProvider.listAvailableModels();
      result.push({ 
        service: 'ollama', 
        models, 
        available: models.length > 0 
      });
    }

    // Check LibreTranslate availability
    if (this.providers.has('libretranslate')) {
      result.push({
        service: 'libretranslate',
        models: [],
        available: true
      });
    }
    
    return result;
  }

  splitTextIntoChunks(text: string, maxChunkSize = 8000): string[] {
    const chunks: string[] = [];
    const paragraphs = text.split(/\n\n+/);
    
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length + 2 > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // If single paragraph exceeds max size, split by sentences
        if (paragraph.length > maxChunkSize) {
          const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
          for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > maxChunkSize) {
              if (currentChunk) {
                chunks.push(currentChunk.trim());
              }
              currentChunk = sentence;
            } else {
              currentChunk += sentence;
            }
          }
        } else {
          currentChunk = paragraph;
        }
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }
}

export const translationService = new TranslationService();
