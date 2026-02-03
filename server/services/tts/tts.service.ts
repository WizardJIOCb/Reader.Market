import { db } from '../../storage';
import { ttsConfig, ttsCache, ttsJobs } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { createHash } from 'crypto';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, statSync, access, constants, stat } from 'fs';
import { promisify } from 'util';

const accessAsync = promisify(access);
const statAsync = promisify(stat);
import { join } from 'path';
import { tmpdir } from 'os';

// Types
export type TtsProviderId = 'rhvoice' | 'piper';
export type TtsLanguage = 'ru' | 'en';
export type TtsFormat = 'mp3' | 'ogg';

export interface SynthesizeOptions {
  lang: TtsLanguage;
  voice: string;
  rate: number; // 0.8..1.25
  format: TtsFormat;
}

export interface TtsProvider {
  id: TtsProviderId;
  listVoices(lang: TtsLanguage): Promise<{ id: string; name: string }[]>;
  synthesizeToWav(text: string, options: SynthesizeOptions, wavOutPath: string): Promise<void>;
}

export interface TtsChunkRequest {
  bookId: string;
  chapterIndex: number | null;
  chunkIndex: number;
  text: string;
  lang: TtsLanguage;
  provider: TtsProviderId;
  voice: string;
  rate: number;
}

export interface TtsChunkResponse {
  status: 'ready' | 'queued' | 'processing' | 'failed';
  textHash?: string;
  audioUrl?: string;
  durationMs?: number;
  jobId?: string;
  error?: string;
}

// Normalize text for consistent hashing
function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n+/g, '\n') // Normalize line breaks
    .normalize(); // Unicode normalization
}

// Generate deterministic hash for caching
function generateTextHash(provider: TtsProviderId, voice: string, lang: TtsLanguage, rate: number, normalizedText: string): string {
  const input = `${provider}|${voice}|${lang}|${rate.toFixed(2)}|${normalizedText}`;
  return createHash('sha256').update(input).digest('hex');
}

// Get storage paths
function getStoragePaths(textHash: string, bookId: string, provider: TtsProviderId, voice: string, format: TtsFormat) {
  const baseDir = process.env.TTS_STORAGE_PATH || join(process.cwd(), 'storage', 'tts');
  const audioPath = join(baseDir, bookId, provider, voice, `${textHash}.${format}`);
  const wavPath = join(tmpdir(), `tts-${textHash}.wav`);
  return { audioPath, wavPath, baseDir };
}

// Ensure directory exists
function ensureDir(path: string) {
  const dirPath = join(path, '..'); // Get parent directory
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

// Convert WAV to target format using ffmpeg
async function convertWavToFormat(wavPath: string, outputPath: string, format: TtsFormat, bitrate: number = 64): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
    const args = [
      '-i', wavPath,
      '-ar', '22050', // Sample rate
      '-ac', '1',     // Mono
      '-b:a', `${bitrate}k`,
      '-y',           // Overwrite output files
      outputPath
    ];

    const proc = spawn(ffmpegPath, args);
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
    
    proc.on('error', reject);
  });
}

// RHVoice Provider Implementation
class RhvoiceProvider implements TtsProvider {
  id: TtsProviderId = 'rhvoice';
  
  async listVoices(lang: TtsLanguage): Promise<{ id: string; name: string }[]> {
    // TODO: Implement actual voice listing from RHVoice
    // For now return hardcoded voices
    if (lang === 'ru') {
      return [
        { id: 'anna', name: 'Anna' },
        { id: 'aleksandr', name: 'Aleksandr' },
        { id: 'elena', name: 'Elena' }
      ];
    } else {
      return [
        { id: 'alan', name: 'Alan' },
        { id: 'bdl', name: 'BDL' },
        { id: 'clb', name: 'CLB' }
      ];
    }
  }
  
  async synthesizeToWav(text: string, options: SynthesizeOptions, wavOutPath: string): Promise<void> {
    const config = await db.select().from(ttsConfig).limit(1);
    let binPath = config[0]?.rhvoiceBinPath || '/usr/bin/RHVoice-test';
    
    // Normalize path for Windows
    if (process.platform === 'win32') {
      binPath = binPath.replace(/\\/g, '/');
    }
    
    // Check if the binary exists before attempting to spawn
    if (!existsSync(binPath)) {
      console.error('RHVoice: Binary not found at path:', binPath);
      throw new Error(`RHVoice binary not found at path: ${binPath}. Please install RHVoice from https://github.com/RHVoice/RHVoice/releases and ensure it's installed at the configured path.`);
    }
    
    // Log for debugging purposes
    console.log('RHVoice: Attempting to execute:', binPath);
    console.log('RHVoice: Arguments:', ['--voice', options.voice, '--rate', Math.round(options.rate * 100).toString(), '--output', wavOutPath]);
    
    return new Promise((resolve, reject) => {
      const args = [
        '--voice', options.voice,
        '--rate', Math.round(options.rate * 100).toString(),
        '--output', wavOutPath
      ];
      
      const proc = spawn(binPath, args, {
        shell: process.platform === 'win32'  // Use shell on Windows for better compatibility
      });
      
      // Capture stderr for better error reporting
      let stderrOutput = '';
      proc.stderr?.on('data', (data) => {
        stderrOutput += data.toString();
      });
      
      proc.stdin.write(text);
      proc.stdin.end();
      
      proc.on('close', (code) => {
        if (code === 0) {
          console.log('RHVoice: Successfully generated audio to', wavOutPath);
          resolve();
        } else {
          const errorMsg = stderrOutput ? `${stderrOutput} (exit code: ${code})` : `RHVoice exited with code ${code}`;
          console.error('RHVoice: Failed to generate audio:', errorMsg);
          reject(new Error(errorMsg));
        }
      });
      
      proc.on('error', (error) => {
        console.error('RHVoice: Spawn error:', error.message);
        reject(new Error(`RHVoice failed to execute: ${binPath}. Error: ${error.message}`));
      });
    });
  }
}

// Piper Provider Implementation
class PiperProvider implements TtsProvider {
  id: TtsProviderId = 'piper';
  
  async listVoices(lang: TtsLanguage): Promise<{ id: string; name: string }[]> {
    const config = await db.select().from(ttsConfig).limit(1);
    const modelsDir = config[0]?.piperModelsDir || '/opt/piper/models';
    
    // TODO: Scan models directory for .onnx files
    // For now return hardcoded voices
    if (lang === 'ru') {
      return [
        { id: 'ru_RU-irina', name: 'Irina (RU)' },
        { id: 'ru_RU-dmitri', name: 'Dmitri (RU)' }
      ];
    } else {
      return [
        { id: 'en_US-lessac', name: 'Lessac (US English)' },
        { id: 'en_GB-alan', name: 'Alan (UK English)' }
      ];
    }
  }
  
  async synthesizeToWav(text: string, options: SynthesizeOptions, wavOutPath: string): Promise<void> {
    const config = await db.select().from(ttsConfig).limit(1);
    let binPath = join(process.cwd(), 'scripts', 'tts_wrapper.py'); // Use our Python wrapper for better Windows compatibility
    let modelsDir = config[0]?.piperModelsDir || '/opt/piper/models';
    
    // Map voice ID to model file
    const modelMap: Record<string, string> = {
      'ru_RU-irina': 'ru_RU-irina-medium.onnx',
      'ru_RU-dmitri': 'ru_RU-dmitri-medium.onnx',
      'en_US-lessac': 'en_US-lessac-medium.onnx',
      'en_GB-alan': 'en_GB-alan-medium.onnx'
    };
    
    const modelFile = modelMap[options.voice];
    if (!modelFile) {
      throw new Error(`Unknown voice: ${options.voice}`);
    }
    
    const modelPath = join(modelsDir, modelFile);
    
    // Log for debugging purposes
    console.log('Piper: Attempting to execute:', binPath);
    console.log('Piper: Model path:', modelPath);
    console.log('Piper: Output path:', wavOutPath);
    
    // Check if model file exists
    if (!existsSync(modelPath)) {
      console.error('Piper: Model file not found:', modelPath);
      throw new Error(`Piper model file not found: ${modelPath}`);
    }
    
    // Prepare parameters as JSON to send to Python wrapper script
    const params = {
      model: modelPath,
      output_file: wavOutPath,
      length_scale: 1 / options.rate,
      text: text
    };
          
    // Use Python to execute our wrapper script, reading parameters from stdin
    const execPath = 'python';
    const args = [binPath]; // Just the wrapper script path
          
    console.log('Piper: Executing command:', execPath, args.join(' '));
    console.log('Piper: Parameters:', JSON.stringify(params));
          
    // For Windows, we need to ensure proper path handling
    const spawnOptions: any = {
      stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
    };
          
    if (process.platform === 'win32') {
      // On Windows, use shell to handle path escaping
      spawnOptions.shell = true;
    }
          
    const proc = spawn(execPath, args, spawnOptions);
        
    // Send parameters as JSON to stdin and close
    proc.stdin.write(JSON.stringify(params));
    proc.stdin.end();
        
    // Capture stderr for better error reporting
    let stderrOutput = '';
    proc.stderr?.on('data', (data) => {
      stderrOutput += data.toString();
    });
        
    // Return a promise that resolves when the process completes
    return new Promise<void>((resolve, reject) => {
      // Set a timeout to prevent indefinite hanging
      const timeoutMs = 30000; // 30 seconds timeout
      const timeout = setTimeout(() => {
        console.error('Piper: Process timed out after', timeoutMs, 'ms');
        if (!proc.killed) {
          proc.kill();
        }
        reject(new Error('Piper process timed out. This may indicate a Piper engine issue on Windows. The process might be hanging due to missing dependencies.'));
      }, timeoutMs);
          
      proc.on('close', (code) => {
        // Clear the timeout if process closes before timeout
        clearTimeout(timeout);
            
        if (code === 0) {
          // Check if the output file was actually created and has content
          accessAsync(wavOutPath, constants.F_OK)
            .then(() => {
              // Check file size to ensure it's not empty
              return statAsync(wavOutPath);
            })
            .then(stats => {
              if (stats.size === 0) {
                console.error('Piper: Generated audio file is empty:', wavOutPath);
                reject(new Error(`Piper generated an empty audio file: ${wavOutPath}. This may indicate a Piper engine issue on Windows. Check that all dependencies are installed: pip install espeak-phonemizer`));
              } else {
                console.log('Piper: Successfully generated audio to', wavOutPath, `(size: ${stats.size} bytes)`);
                resolve();
              }
            })
            .catch(err => {
              console.error('Piper: Output file was not created or has issues:', wavOutPath, err.message);
              reject(new Error(`Piper generated audio file was not created or has issues: ${wavOutPath}. Error: ${err.message}`));
            });
        } else {
          const errorMsg = stderrOutput ? `${stderrOutput} (exit code: ${code})` : `Piper exited with code ${code}`;
          console.error('Piper: Failed to generate audio:', errorMsg);
              
          // Provide specific guidance for Windows users
          if (process.platform === 'win32' && stderrOutput.includes('espeakbridge')) {
            console.error('Piper: Windows-specific error detected. Please install espeak-phonemizer:');
            console.error('pip install espeak-phonemizer');
          }
              
          reject(new Error(errorMsg));
        }
      });
          
      proc.on('error', (error) => {
        // Clear the timeout if there's an error
        clearTimeout(timeout);
        console.error('Piper: Spawn error:', error.message);
        reject(new Error(`Piper process failed: ${error.message}`));
      });
    });
  }
}

// Main TTS Service
export class TtsService {
  private providers: Record<TtsProviderId, TtsProvider> = {
    rhvoice: new RhvoiceProvider(),
    piper: new PiperProvider()
  };
  
  async getConfig() {
    console.log('TTS Service: getConfig called');
    
    // Be more explicit about which record to get
    const config = await db.select().from(ttsConfig).where(eq(ttsConfig.id, 'default')).limit(1);
    console.log('TTS Service: Raw DB result:', config[0]);
    
    if (!config[0]) {
      console.log('TTS Service: No config found');
      return null;
    }
    
    // Cast to any to bypass TypeScript checking for snake_case properties
    const dbRecord: any = config[0];
    console.log('TTS Service: dbRecord.tts_enabled:', dbRecord.tts_enabled);
    console.log('TTS Service: dbRecord.ttsEnabled:', dbRecord.ttsEnabled);  // Try camelCase
    console.log('TTS Service: dbRecord.default_rate:', dbRecord.default_rate);
    console.log('TTS Service: dbRecord.defaultRate:', dbRecord.defaultRate);  // Try camelCase
    console.log('TTS Service: dbRecord.min_rate:', dbRecord.min_rate);
    console.log('TTS Service: dbRecord.minRate:', dbRecord.minRate);  // Try camelCase
    console.log('TTS Service: dbRecord.max_rate:', dbRecord.max_rate);
    console.log('TTS Service: dbRecord.maxRate:', dbRecord.maxRate);  // Try camelCase
    
    const result = {
      id: dbRecord.id,
      ttsEnabled: dbRecord.ttsEnabled !== undefined ? dbRecord.ttsEnabled : dbRecord.tts_enabled,
      enabledProviders: dbRecord.enabledProviders !== undefined ? dbRecord.enabledProviders : dbRecord.enabled_providers,
      defaultProvider: dbRecord.defaultProvider !== undefined ? dbRecord.defaultProvider : dbRecord.default_provider,
      defaultLang: dbRecord.defaultLang !== undefined ? dbRecord.defaultLang : dbRecord.default_lang,
      defaultVoiceRu: dbRecord.defaultVoiceRu !== undefined ? dbRecord.defaultVoiceRu : dbRecord.default_voice_ru,
      defaultVoiceEn: dbRecord.defaultVoiceEn !== undefined ? dbRecord.defaultVoiceEn : dbRecord.default_voice_en,
      defaultRate: dbRecord.defaultRate !== undefined ? 
        (typeof dbRecord.defaultRate === 'string' ? parseFloat(dbRecord.defaultRate) : dbRecord.defaultRate) :
        (dbRecord.default_rate != null ? parseFloat(dbRecord.default_rate) : 1.0),
      minRate: dbRecord.minRate !== undefined ? 
        (typeof dbRecord.minRate === 'string' ? parseFloat(dbRecord.minRate) : dbRecord.minRate) :
        (dbRecord.min_rate != null ? parseFloat(dbRecord.min_rate) : 0.8),
      maxRate: dbRecord.maxRate !== undefined ? 
        (typeof dbRecord.maxRate === 'string' ? parseFloat(dbRecord.maxRate) : dbRecord.maxRate) :
        (dbRecord.max_rate != null ? parseFloat(dbRecord.max_rate) : 1.25),
      chunkMinChars: dbRecord.chunkMinChars !== undefined ? dbRecord.chunkMinChars : dbRecord.chunk_min_chars,
      chunkMaxChars: dbRecord.chunkMaxChars !== undefined ? dbRecord.chunkMaxChars : dbRecord.chunk_max_chars,
      audioFormat: dbRecord.audioFormat !== undefined ? dbRecord.audioFormat : dbRecord.audio_format,
      mp3Bitrate: dbRecord.mp3Bitrate !== undefined ? dbRecord.mp3Bitrate : dbRecord.mp3_bitrate,
      queueConcurrency: dbRecord.queueConcurrency !== undefined ? dbRecord.queueConcurrency : dbRecord.queue_concurrency,
      cacheMaxGb: dbRecord.cacheMaxGb !== undefined ? dbRecord.cacheMaxGb : dbRecord.cache_max_gb,
      cacheTtlDays: dbRecord.cacheTtlDays !== undefined ? dbRecord.cacheTtlDays : dbRecord.cache_ttl_days,
      rhvoiceBinPath: dbRecord.rhvoiceBinPath !== undefined ? dbRecord.rhvoiceBinPath : dbRecord.rhvoice_bin_path,
      piperBinPath: dbRecord.piperBinPath !== undefined ? dbRecord.piperBinPath : dbRecord.piper_bin_path,
      piperModelsDir: dbRecord.piperModelsDir !== undefined ? dbRecord.piperModelsDir : dbRecord.piper_models_dir,
      createdAt: dbRecord.createdAt !== undefined ? dbRecord.createdAt : dbRecord.created_at,
      updatedAt: dbRecord.updatedAt !== undefined ? dbRecord.updatedAt : dbRecord.updated_at
    };
    
    console.log('TTS Service: Result before processing:', result);
    
    // Ensure enabledProviders is properly parsed as array
    if (typeof result.enabledProviders === 'string') {
      try {
        result.enabledProviders = JSON.parse(result.enabledProviders);
      } catch (e) {
        // If parsing fails, default to both providers enabled
        result.enabledProviders = ['rhvoice', 'piper'];
      }
    }
    
    // Ensure enabledProviders is always an array
    if (!Array.isArray(result.enabledProviders)) {
      result.enabledProviders = ['rhvoice', 'piper'];
    }
    
    // Ensure boolean fields are properly handled
    if (result.ttsEnabled == null) {
      result.ttsEnabled = false;
    }
    
    console.log('TTS Service: Final result:', result);
    return result;
  }
  
  async listVoices(providerId: TtsProviderId, lang: TtsLanguage) {
    const provider = this.providers[providerId];
    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }
    return await provider.listVoices(lang);
  }
  
  async processChunk(request: TtsChunkRequest): Promise<TtsChunkResponse> {
    // Validate config
    const config = await this.getConfig();
    if (!config?.ttsEnabled) {
      return { status: 'failed', error: 'TTS is disabled' };
    }
    
    if (!(config.enabledProviders as string[]).includes(request.provider)) {
      return { status: 'failed', error: `Provider ${request.provider} is not enabled` };
    }
    
    // Validate rate
    const minRate = typeof config.minRate === 'number' ? config.minRate : 0.8;
    const maxRate = typeof config.maxRate === 'number' ? config.maxRate : 1.25;
    if (request.rate < minRate || request.rate > maxRate) {
      return { status: 'failed', error: `Rate must be between ${minRate} and ${maxRate}` };
    }
    
    // Validate text length
    if (request.text.length > 5000) {
      return { status: 'failed', error: 'Text too long (max 5000 characters)' };
    }
    
    // Normalize text and generate hash
    const normalizedText = normalizeText(request.text);
    const textHash = generateTextHash(
      request.provider,
      request.voice,
      request.lang,
      request.rate,
      normalizedText
    );
    
    // Check cache first
    const cached = await db.select().from(ttsCache).where(eq(ttsCache.textHash, textHash)).limit(1);
    if (cached[0]) {
      // Update last accessed time
      await db.update(ttsCache)
        .set({ lastAccessedAt: new Date() })
        .where(eq(ttsCache.textHash, textHash));
      
      return {
        status: 'ready',
        textHash,
        audioUrl: `/media/tts/${cached[0].audioPath.split('tts/')[1]}`,
        durationMs: cached[0].durationMs || 0
      };
    }
    
    // Check if job already exists
    const existingJob = await db.select().from(ttsJobs).where(eq(ttsJobs.textHash, textHash)).limit(1);
    if (existingJob[0]) {
      return {
        status: existingJob[0].status as any,
        textHash,
        jobId: existingJob[0].id
      };
    }
    
    // Create job
    const job = await db.insert(ttsJobs).values({
      textHash,
      status: 'queued',
      provider: request.provider,
      lang: request.lang,
      voice: request.voice,
      rate: request.rate.toString(),
      format: config.audioFormat
    }).returning();
    
    // Process asynchronously
    this.processJob(job[0].id, request, textHash, normalizedText);
    
    return {
      status: 'queued',
      textHash,
      jobId: job[0].id
    };
  }
  
  private async processJob(jobId: string, request: TtsChunkRequest, textHash: string, normalizedText: string) {
    try {
      // Update job status
      await db.update(ttsJobs).set({ status: 'processing' }).where(eq(ttsJobs.id, jobId));
      
      const config = await this.getConfig();
      if (!config) throw new Error('TTS config not found');
      
      // Get provider
      const provider = this.providers[request.provider];
      if (!provider) throw new Error(`Unknown provider: ${request.provider}`);
      
      // Get storage paths
      const { audioPath, wavPath, baseDir } = getStoragePaths(
        textHash,
        request.bookId,
        request.provider,
        request.voice,
        config.audioFormat as TtsFormat
      );
      
      // Ensure directories exist
      ensureDir(audioPath);
      
      // Synthesize to WAV
      await provider.synthesizeToWav(normalizedText, {
        lang: request.lang,
        voice: request.voice,
        rate: request.rate,
        format: 'mp3' // Intermediate format
      }, wavPath);
      
      // Convert to target format
      await convertWavToFormat(wavPath, audioPath, config.audioFormat as TtsFormat, config.mp3Bitrate);
      
      // Get file stats
      // const stats = statSync(audioPath);
      
      // Save to cache
      await db.insert(ttsCache).values({
        bookId: request.bookId,
        chapterIndex: request.chapterIndex ?? undefined,
        chunkIndex: request.chunkIndex,
        provider: request.provider,
        lang: request.lang,
        voice: request.voice,
        rate: request.rate.toString(),
        format: config.audioFormat,
        textHash,
        audioPath,
        // audioSize: stats.size,
        // durationMs: estimated based on text length
      });
      
      // Update job status
      await db.update(ttsJobs).set({ 
        status: 'ready' 
      }).where(eq(ttsJobs.id, jobId));
      
      // Cleanup temp file
      try {
        unlinkSync(wavPath);
      } catch (e) {
        // Ignore cleanup errors
      }
      
    } catch (error: any) {
      // Update job with error
      await db.update(ttsJobs).set({ 
        status: 'failed',
        errorMessage: error.message
      }).where(eq(ttsJobs.id, jobId));
    }
  }
  
  async getJobStatus(textHash: string): Promise<TtsChunkResponse> {
    const job = await db.select().from(ttsJobs).where(eq(ttsJobs.textHash, textHash)).limit(1);
    if (!job[0]) {
      return { status: 'failed', error: 'Job not found' };
    }
    
    if (job[0].status === 'ready') {
      const cached = await db.select().from(ttsCache).where(eq(ttsCache.textHash, textHash)).limit(1);
      if (cached[0]) {
        return {
          status: 'ready',
          textHash,
          audioUrl: `/media/tts/${cached[0].audioPath.split('tts/')[1]}`,
          durationMs: cached[0].durationMs || 0
        };
      }
    }
    
    return {
      status: job[0].status as any,
      textHash,
      jobId: job[0].id
    };
  }
}

// Export singleton instance
export const ttsService = new TtsService();