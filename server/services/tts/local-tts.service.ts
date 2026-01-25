import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

interface TTSResult {
  success: boolean;
  audioUrl?: string;
  duration?: number;
  error?: string;
}

export class LocalTTSService {
  private ollamaModel = 'llama3.2'; // Будем использовать доступную модель
  private audioDir = path.join(process.cwd(), 'uploads', 'audio');
  
  constructor() {
    // Убедимся, что директория существует
    this.ensureAudioDir();
  }
  
  private async ensureAudioDir() {
    try {
      await fs.mkdir(this.audioDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create audio directory:', error);
    }
  }
  
  async generateCharacterVoice(
    text: string, 
    character: string, 
    emotion: string
  ): Promise<TTSResult> {
    try {
      console.log(`[TTS] Generating voice for character: ${character}`);
      
      // 1. Стилизуем текст через LLM
      const styledText = await this.styleWithLLM(text, character, emotion);
      
      // 2. Генерируем аудио через системный TTS (временно)
      const audioPath = await this.generateSystemAudio(styledText, character);
      
      return {
        success: true,
        audioUrl: `/audio/${path.basename(audioPath)}`,
        duration: await this.getAudioDuration(audioPath)
      };
      
    } catch (error) {
      console.error('[TTS] Generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  private async styleWithLLM(text: string, character: string, emotion: string): Promise<string> {
    try {
      const prompt = this.buildCharacterPrompt(text, character, emotion);
      
      // Пока используем простую стилизацию, позже интегрируем Ollama
      const styled = this.simpleStyleText(text, character, emotion);
      console.log(`[TTS] Styled text: ${styled.substring(0, 50)}...`);
      
      return styled;
    } catch (error) {
      console.error('[TTS] LLM styling failed:', error);
      return text; // Возвращаем оригинальный текст если стилизация не удалась
    }
  }
  
  private buildCharacterPrompt(text: string, character: string, emotion: string): string {
    const personas = {
      'Манус': `Преобразуй этот текст в стиле Примарха Мануса (грозный, авторитетный): "${text}"`,
      'Робаут': `Преобразуй этот текст в стиле Робаута Гильманна (таинственный, расчетливый): "${text}"`,
      'Корнелиус': `Преобразуй этот текст в стиле Корнелиуса (героический, благородный): "${text}"`
    };
    
    return personas[character as keyof typeof personas] || text;
  }
  
  private simpleStyleText(text: string, character: string, emotion: string): string {
    // Временная простая стилизация
    const modifiers = {
      'Манус': {
        'menacing': (t: string) => t.toUpperCase() + '!!!',
        'heroic': (t: string) => `ГОВОРИТ МАНУС: ${t.toUpperCase()}!`,
        'mysterious': (t: string) => `[шепотом] ${t.toLowerCase()}...`
      },
      'Робаут': {
        'menacing': (t: string) => `*темный шепот* ${t} *угроза*`,
        'heroic': (t: string) => `РОБАУТ: ${t}`,
        'mysterious': (t: string) => `${t}... *исчезает в тенях*`
      },
      'Корнелиус': {
        'menacing': (t: string) => `КОРНЕЛИУС ПРЕДУПРЕЖДАЕТ: ${t.toUpperCase()}!`,
        'heroic': (t: string) => `СВЕТ ПРАВДЫ: ${t}`,
        'mysterious': (t: string) => `[задумчиво] ${t}...`
      }
    };
    
    const charModifiers = modifiers[character as keyof typeof modifiers];
    if (charModifiers) {
      const emotionModifier = charModifiers[emotion as keyof typeof charModifiers];
      if (emotionModifier) {
        return emotionModifier(text);
      }
    }
    
    return text;
  }
  
  private async generateSystemAudio(text: string, character: string): Promise<string> {
    try {
      // Используем системный TTS как временное решение
      const filename = `tts_${Date.now()}_${character.replace(/\s+/g, '_')}.wav`;
      const outputPath = path.join(this.audioDir, filename);
      
      // Создаем простой WAV файл с текстом (заглушка)
      await this.createDummyAudio(outputPath, text);
      
      console.log(`[TTS] Audio generated: ${outputPath}`);
      return outputPath;
      
    } catch (error) {
      console.error('[TTS] Audio generation failed:', error);
      throw error;
    }
  }
  
  private async createDummyAudio(filepath: string, text: string): Promise<void> {
    // Создаем простой WAV файл (заглушка для тестирования)
    const dummyWavHeader = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x24, 0x00, 0x00, 0x00, // File size - 36 bytes
      0x57, 0x41, 0x56, 0x45, // "WAVE"
      0x66, 0x6d, 0x74, 0x20, // "fmt "
      0x10, 0x00, 0x00, 0x00, // Chunk size
      0x01, 0x00, 0x01, 0x00, // Format (PCM), Channels (1)
      0x40, 0x1f, 0x00, 0x00, // Sample rate (8000 Hz)
      0x40, 0x1f, 0x00, 0x00, // Byte rate
      0x01, 0x00, 0x08, 0x00, // Block align, Bits per sample
      0x64, 0x61, 0x74, 0x61, // "data"
      0x00, 0x00, 0x00, 0x00  // Data size
    ]);
    
    await fs.writeFile(filepath, dummyWavHeader);
    
    // Сохраняем текст в отдельный файл для отладки
    const textFile = filepath.replace('.wav', '.txt');
    await fs.writeFile(textFile, text);
  }
  
  private async getAudioDuration(filepath: string): Promise<number> {
    // Временно возвращаем фиксированную длительность
    return 5.0; // секунд
  }
  
  // Методы для будущей интеграции с Ollama
  private async initializeOllama() {
    try {
      // Проверяем доступность Ollama
      await execAsync('ollama --version');
      console.log('[TTS] Ollama is available');
      return true;
    } catch (error) {
      console.log('[TTS] Ollama not available, using simple styling');
      return false;
    }
  }
  
  public async healthCheck(): Promise<{ status: string; models: string[] }> {
    try {
      const ollamaAvailable = await this.initializeOllama();
      return {
        status: 'ok',
        models: ollamaAvailable ? ['llama3.2'] : ['simple-styling']
      };
    } catch (error) {
      return {
        status: 'error',
        models: []
      };
    }
  }
}