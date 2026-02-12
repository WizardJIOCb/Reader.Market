import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireAdminOrModerator } from '../middleware/admin-auth';
import { storage as dbStorage } from '../storage';

import multer from 'multer';

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Define the destination for uploaded audio files
    const uploadDir = process.env.VOICE_SAMPLES_DIR || './uploads/voice-samples';
    const fs = require('fs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate a unique filename for the audio sample
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = file.originalname.split('.').pop();
    cb(null, 'voice-sample-' + uniqueSuffix + '.' + ext);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Only allow audio files
    const allowedTypes = /wav|mp3|flac|m4a|aac|ogg|opus/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype || extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed') as any);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

export function createTTSRouter() {
  const router = Router();

  // TTS files endpoint
  router.get('/files/:filename', (req, res) => {
    // This would handle serving TTS audio files
    // Implementation depends on how TTS files are stored and served
    const filename = req.params.filename;
    
    // Security check to prevent directory traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filePath = `./uploads/tts/${filename}`;
    
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error sending TTS file:', err);
        res.status(404).json({ error: 'File not found' });
      }
    });
  });

  // Additional TTS routes can be added here as needed
  
  // TTS Admin Configuration endpoints
  router.get('/admin/config', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      // Use the TTS service directly instead of storage
      const { ttsService } = await import('../services/tts/tts.service');
      const config = await ttsService.getConfig();
      
      if (!config) {
        return res.status(404).json({ error: 'TTS configuration not found' });
      }
      
      res.json(config);
    } catch (error) {
      console.error('Error getting TTS config:', error);
      res.status(500).json({ error: 'Failed to get TTS configuration' });
    }
  });
  
  router.put('/admin/config', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      // Update the TTS configuration in the database
      const { ttsService } = await import('../services/tts/tts.service');
      
      const updatedConfig = await ttsService.updateConfig(req.body);
      res.json(updatedConfig);
    } catch (error) {
      console.error('Error updating TTS config:', error);
      res.status(500).json({ error: 'Failed to update TTS configuration' });
    }
  });
  
  // TTS Cache Statistics endpoint
  router.get('/admin/cache-stats', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      // Use the TTS service to get cache statistics
      const { ttsService } = await import('../services/tts/tts.service');
      // This would get cache statistics - for now return a sample response
      res.json({
        totalCachedFiles: 0,
        sizeGb: 0,
        oldestEntry: null,
        newestEntry: null,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error getting TTS cache stats:', error);
      res.status(500).json({ error: 'Failed to get TTS cache statistics' });
    }
  });
  
  // Voice cloning endpoints
  router.post('/admin/voice-cloning/upload', authenticateToken, requireAdminOrModerator, upload.single('audio'), async (req, res) => {
    try {
      // This endpoint will handle audio sample uploads for voice cloning
      // Implementation will depend on MimikaStudio's voice cloning API
      
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }
      
      // Get configuration to get the API URL
      const { ttsService } = await import('../services/tts/tts.service');
      const config = await ttsService.getConfig();
      
      const apiUrl = config?.mimikaStudioApiUrl || process.env.MIMIKASTUDIO_API_URL || 'http://localhost:8000';
      const apiKey = config?.mimikaStudioApiKey || process.env.MIMIKASTUDIO_API_KEY;
      
      // Prepare request headers
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      // Prepare form data for MimikaStudio API using a library that works in Node.js
      const FormData = require('form-data');
      const fs = require('fs');
      
      const formData = new FormData();
      const fileStream = fs.createReadStream(req.file.path);
      
      // Append the audio file
      formData.append('audio', fileStream, {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });
      
      // Optionally include metadata
      if (req.body.name) {
        formData.append('name', req.body.name);
      }
      if (req.body.description) {
        formData.append('description', req.body.description);
      }
      
      // Merge form data headers with auth headers
      const formHeaders = formData.getHeaders();
      const mergedHeaders = { ...headers, ...formHeaders };
      
      // Call MimikaStudio API to create voice clone
      const response = await fetch(`${apiUrl}/api/voice-cloning/upload`, {
        method: 'POST',
        headers: mergedHeaders,
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`MimikaStudio: Voice cloning upload failed - ${response.status} ${errorText}`);
        return res.status(response.status).json({ error: `MimikaStudio API error: ${response.status} - ${errorText}` });
      }
      
      const result = await response.json();
      
      // Return success response
      res.json({
        success: true,
        message: 'Voice sample uploaded successfully',
        sampleId: result.sampleId || req.file.filename,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
      });
      
      // Clean up temporary file after sending response
      setTimeout(() => {
        try {
          if (req.file && req.file.path) {
            require('fs').unlinkSync(req.file.path);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up temp file:', cleanupError);
        }
      }, 1000);
      
    } catch (error: any) {
      console.error('Error uploading voice sample:', error);
      
      // Clean up temporary file on error
      if (req.file && req.file.path) {
        try {
          require('fs').unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up temp file on error:', cleanupError);
        }
      }
      
      res.status(500).json({ error: 'Failed to upload voice sample: ' + error.message });
    }
  });
  
  router.get('/admin/voice-cloning/samples', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      // This endpoint will return a list of uploaded voice samples
      // For now, return a not implemented response
      res.status(501).json({ error: 'Voice samples listing not implemented' });
    } catch (error) {
      console.error('Error listing voice samples:', error);
      res.status(500).json({ error: 'Failed to list voice samples' });
    }
  });
  
  router.delete('/admin/voice-cloning/samples/:sampleId', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      // This endpoint will delete a voice sample
      // For now, return a not implemented response
      res.status(501).json({ error: 'Voice sample deletion not implemented' });
    } catch (error) {
      console.error('Error deleting voice sample:', error);
      res.status(500).json({ error: 'Failed to delete voice sample' });
    }
  });
  
  // Audiobook creation endpoints
  router.post('/admin/audiobook/create', authenticateToken, requireAdminOrModerator, upload.single('document'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No document file provided' });
      }
      
      // Get configuration to get the API URL
      const { ttsService } = await import('../services/tts/tts.service');
      const config = await ttsService.getConfig();
      
      const apiUrl = config?.mimikaStudioApiUrl || process.env.MIMIKASTUDIO_API_URL || 'http://localhost:8000';
      const apiKey = config?.mimikaStudioApiKey || process.env.MIMIKASTUDIO_API_KEY;
      
      // Prepare request headers
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      // Prepare form data for MimikaStudio API
      const FormData = require('form-data');
      const fs = require('fs');
      
      const formData = new FormData();
      const fileStream = fs.createReadStream(req.file.path);
      
      // Append the document file
      formData.append('document', fileStream, {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });
      
      // Include any additional options from the request body
      if (req.body.voice) {
        formData.append('voice', req.body.voice);
      }
      if (req.body.outputFormat) {
        formData.append('outputFormat', req.body.outputFormat);
      }
      if (req.body.chapterMarkers) {
        formData.append('chapterMarkers', req.body.chapterMarkers);
      }
      
      // Merge form data headers with auth headers
      const formHeaders = formData.getHeaders();
      const mergedHeaders = { ...headers, ...formHeaders };
      
      // Call MimikaStudio API to create audiobook
      const response = await fetch(`${apiUrl}/api/audiobook/create`, {
        method: 'POST',
        headers: mergedHeaders,
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`MimikaStudio: Audiobook creation failed - ${response.status} ${errorText}`);
        return res.status(response.status).json({ error: `MimikaStudio API error: ${response.status} - ${errorText}` });
      }
      
      const result = await response.json();
      
      // Return success response
      res.json({
        success: true,
        message: 'Audiobook creation started successfully',
        jobId: result.jobId,
        documentName: req.file.originalname,
        status: 'processing'
      });
      
      // Clean up temporary file after sending response
      setTimeout(() => {
        try {
          if (req.file && req.file.path) {
            require('fs').unlinkSync(req.file.path);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up temp file:', cleanupError);
        }
      }, 1000);
      
    } catch (error: any) {
      console.error('Error creating audiobook:', error);
      
      // Clean up temporary file on error
      if (req.file && req.file.path) {
        try {
          require('fs').unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up temp file on error:', cleanupError);
        }
      }
      
      res.status(500).json({ error: 'Failed to create audiobook: ' + error.message });
    }
  });
  
  // Endpoint to check audiobook creation job status
  router.get('/admin/audiobook/status/:jobId', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const { jobId } = req.params;
      
      // Get configuration to get the API URL
      const { ttsService } = await import('../services/tts/tts.service');
      const config = await ttsService.getConfig();
      
      const apiUrl = config?.mimikaStudioApiUrl || process.env.MIMIKASTUDIO_API_URL || 'http://localhost:8000';
      const apiKey = config?.mimikaStudioApiKey || process.env.MIMIKASTUDIO_API_KEY;
      
      // Prepare request headers
      const headers: Record<string, string> = {};
      
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      // Call MimikaStudio API to get job status
      const response = await fetch(`${apiUrl}/api/audiobook/status/${jobId}`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`MimikaStudio: Get audiobook status failed - ${response.status} ${errorText}`);
        return res.status(response.status).json({ error: `MimikaStudio API error: ${response.status} - ${errorText}` });
      }
      
      const result = await response.json();
      
      res.json(result);
      
    } catch (error: any) {
      console.error('Error getting audiobook status:', error);
      res.status(500).json({ error: 'Failed to get audiobook status: ' + error.message });
    }
  });
  
  // IPA Transcription endpoint
  router.post('/admin/ipa-transcribe', authenticateToken, requireAdminOrModerator, async (req, res) => {
    try {
      const { text, language = 'en', llmProvider = 'ollama' } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required for IPA transcription' });
      }
      
      // Get configuration to get the API URL
      const { ttsService } = await import('../services/tts/tts.service');
      const config = await ttsService.getConfig();
      
      const apiUrl = config?.mimikaStudioApiUrl || process.env.MIMIKASTUDIO_API_URL || 'http://localhost:8000';
      const apiKey = config?.mimikaStudioApiKey || process.env.MIMIKASTUDIO_API_KEY;
      
      // Prepare request headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      // Call MimikaStudio API for IPA transcription
      const response = await fetch(`${apiUrl}/api/ipa/transcribe`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text,
          language,
          llmProvider
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`MimikaStudio: IPA transcription failed - ${response.status} ${errorText}`);
        return res.status(response.status).json({ error: `MimikaStudio API error: ${response.status} - ${errorText}` });
      }
      
      const result = await response.json();
      
      res.json(result);
      
    } catch (error: any) {
      console.error('Error with IPA transcription:', error);
      res.status(500).json({ error: 'Failed to perform IPA transcription: ' + error.message });
    }
  });
  
  return router;
}