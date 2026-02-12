import { TtsProvider, SynthesizeOptions, TtsLanguage, TtsProviderId } from './tts.service';

/**
 * MimikaStudio TTS Provider
 * Implements the TtsProvider interface to integrate with MimikaStudio's TTS capabilities
 */
export default class MimikaStudioProvider implements TtsProvider {
  id: TtsProviderId = 'mimikastudio';

  /**
   * Lists available voices from MimikaStudio
   * @param lang - The language for which to list voices
   * @returns Promise resolving to an array of voice objects
   */
  async listVoices(lang: TtsLanguage): Promise<{ id: string; name: string }[]> {
    try {
      // Get configuration to get the API URL
      const { ttsService } = await import('./tts.service');
      const config = await ttsService.getConfig();
      
      const apiUrl = config?.mimikaStudioApiUrl || process.env.MIMIKASTUDIO_API_URL || 'http://localhost:8000';
      
      // Call MimikaStudio API to get available voices
      const response = await fetch(`${apiUrl}/api/voices`);
      
      if (!response.ok) {
        console.error(`MimikaStudio: Failed to fetch voices - ${response.status} ${await response.text()}`);
        // Return fallback voices if API call fails
        if (lang === 'ru') {
          return [
            { id: 'mimika-ru-voice1', name: 'Mimika Russian Voice 1' },
            { id: 'mimika-ru-voice2', name: 'Mimika Russian Voice 2' }
          ];
        } else {
          return [
            { id: 'mimika-en-voice1', name: 'Mimika English Voice 1' },
            { id: 'mimika-en-voice2', name: 'Mimika English Voice 2' },
            { id: 'mimika-emotion-happy', name: 'Happy Emotion Voice' },
            { id: 'mimika-emotion-sad', name: 'Sad Emotion Voice' },
            { id: 'mimika-emotion-angry', name: 'Angry Emotion Voice' }
          ];
        }
      }
      
      const data = await response.json();
      
      // Transform the response to match the expected format
      if (Array.isArray(data)) {
        return data.map((voice: any) => ({
          id: voice.id || voice.name,
          name: voice.name || voice.id
        }));
      } else if (data && typeof data === 'object' && Array.isArray(data.voices)) {
        return data.voices.map((voice: any) => ({
          id: voice.id || voice.name,
          name: voice.name || voice.id
        }));
      } else {
        console.warn('MimikaStudio: Unexpected voices API response format:', data);
        // Fallback to default voices
        if (lang === 'ru') {
          return [
            { id: 'mimika-ru-voice1', name: 'Mimika Russian Voice 1' },
            { id: 'mimika-ru-voice2', name: 'Mimika Russian Voice 2' }
          ];
        } else {
          return [
            { id: 'mimika-en-voice1', name: 'Mimika English Voice 1' },
            { id: 'mimika-en-voice2', name: 'Mimika English Voice 2' },
            { id: 'mimika-emotion-happy', name: 'Happy Emotion Voice' },
            { id: 'mimika-emotion-sad', name: 'Sad Emotion Voice' },
            { id: 'mimika-emotion-angry', name: 'Angry Emotion Voice' }
          ];
        }
      }
    } catch (error) {
      console.error('MimikaStudio: Error fetching voices:', error);
      // Return fallback voices on error
      if (lang === 'ru') {
        return [
          { id: 'mimika-ru-voice1', name: 'Mimika Russian Voice 1' },
          { id: 'mimika-ru-voice2', name: 'Mimika Russian Voice 2' }
        ];
      } else {
        return [
          { id: 'mimika-en-voice1', name: 'Mimika English Voice 1' },
          { id: 'mimika-en-voice2', name: 'Mimika English Voice 2' },
          { id: 'mimika-emotion-happy', name: 'Happy Emotion Voice' },
          { id: 'mimika-emotion-sad', name: 'Sad Emotion Voice' },
          { id: 'mimika-emotion-angry', name: 'Angry Emotion Voice' }
        ];
      }
    }
  }

  /**
   * Synthesizes text to WAV format using MimikaStudio
   * @param text - The text to synthesize
   * @param options - Synthesis options including language, voice, rate, and format
   * @param wavOutPath - The output path for the WAV file
   * @returns Promise that resolves when synthesis is complete
   */
  async synthesizeToWav(text: string, options: SynthesizeOptions, wavOutPath: string): Promise<void> {
    console.log(`MimikaStudio: Synthesizing text with voice "${options.voice}", language "${options.lang}", rate "${options.rate}"`);
    console.log(`MimikaStudio: Output path: ${wavOutPath}`);
    
    try {
      // Get configuration to get the API URL
      const { ttsService } = await import('./tts.service');
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
      
      // Call MimikaStudio API to perform TTS synthesis
      const response = await fetch(`${apiUrl}/api/tts/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text,
          voice: options.voice,
          language: options.lang,
          rate: options.rate,
          format: 'wav'  // Request WAV format
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`MimikaStudio: TTS synthesis failed - ${response.status} ${errorText}`);
        throw new Error(`MimikaStudio API error: ${response.status} - ${errorText}`);
      }
      
      // Get the audio data from the response
      const audioArrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(audioArrayBuffer);
      
      // Write the audio data to the output file
      const fs = require('fs');
      fs.writeFileSync(wavOutPath, audioBuffer);
      
      console.log(`MimikaStudio: Successfully saved audio to ${wavOutPath}`);
    } catch (error: any) {
      console.error('MimikaStudio: Error synthesizing text:', error);
      
      // If the API call fails, create a placeholder WAV file so the process doesn't break
      try {
        const fs = require('fs');
        
        // Create a simple WAV header (this is a simplified example)
        const wavHeader = Buffer.alloc(44);
        wavHeader.write('RIFF', 0);
        wavHeader.writeUInt32LE(36, 4); // File size - 8 (will be updated after writing data)
        wavHeader.write('WAVE', 8);
        wavHeader.write('fmt ', 12);
        wavHeader.writeUInt32LE(16, 16); // Format chunk size
        wavHeader.writeUInt16LE(1, 20); // Audio format (1 = PCM)
        wavHeader.writeUInt16LE(1, 22); // Number of channels
        wavHeader.writeUInt32LE(22050, 24); // Sample rate
        wavHeader.writeUInt32LE(22050 * 1 * 16 / 8, 28); // Byte rate
        wavHeader.writeUInt16LE(1 * 16 / 8, 32); // Block align
        wavHeader.writeUInt16LE(16, 34); // Bits per sample
        wavHeader.write('data', 36); // Data chunk header
        wavHeader.writeUInt32LE(0, 40); // Data chunk size (empty for now)
        
        // Write the WAV header to the output file
        fs.writeFileSync(wavOutPath, wavHeader);
        
        console.warn(`MimikaStudio: Created placeholder WAV file at ${wavOutPath} due to API error`);
      } catch (placeholderError) {
        console.error('MimikaStudio: Error creating placeholder file:', placeholderError);
      }
      
      throw new Error(`MimikaStudio TTS synthesis failed: ${error.message || 'Unknown error'}`);
    }
  }
}