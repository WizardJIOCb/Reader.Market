import { Router } from 'express';
import { LocalTTSService } from '../services/tts/local-tts.service';

const router = Router();
const ttsService = new LocalTTSService();

// Health check endpoint (public)
router.get('/health', async (req, res) => {
  try {
    const health = await ttsService.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Get available characters and emotions (public)
router.get('/config', (req, res) => {
  res.json({
    characters: [
      { id: 'Манус', name: 'Примарх Манус', description: 'Гнев и авторитет' },
      { id: 'Робаут', name: 'Робаут Гильманн', description: 'Тени и тайны' },
      { id: 'Корнелиус', name: 'Корнелиус', description: 'Свет и правда' }
    ],
    emotions: [
      { id: 'menacing', name: 'Грозный', description: 'Угрожающий тон' },
      { id: 'heroic', name: 'Героический', description: 'Вдохновляющий тон' },
      { id: 'mysterious', name: 'Таинственный', description: 'Загадочный тон' }
    ]
  });
});

// Main TTS generation endpoint (requires authentication)
router.post('/persona', async (req, res) => {
  try {
    // Проверяем авторизацию
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }
    
    const token = authHeader.substring(7);
    // Здесь можно добавить проверку JWT токена
    
    const { text, character, emotion = 'menacing' } = req.body;
    
    // Валидация входных данных
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Text is required and must be a string' 
      });
    }
    
    if (!character || typeof character !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Character is required and must be a string' 
      });
    }
    
    // Проверка допустимых значений
    const validCharacters = ['Манус', 'Робаут', 'Корнелиус'];
    const validEmotions = ['menacing', 'heroic', 'mysterious'];
    
    if (!validCharacters.includes(character)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid character. Valid options: ${validCharacters.join(', ')}` 
      });
    }
    
    if (!validEmotions.includes(emotion)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid emotion. Valid options: ${validEmotions.join(', ')}` 
      });
    }
    
    console.log(`[TTS API] Request: ${character} - ${emotion} - ${text.substring(0, 50)}...`);
    
    // Генерация TTS
    const result = await ttsService.generateCharacterVoice(text, character, emotion);
    
    if (result.success) {
      res.json({
        success: true,
        audioUrl: result.audioUrl,
        duration: result.duration,
        character,
        emotion,
        originalText: text,
        styledText: 'Styled version would be here' // Позже добавим реальную стилизацию
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'TTS generation failed'
      });
    }
    
  } catch (error) {
    console.error('[TTS API] Unexpected error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

export default router;