import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ttsConfig, ttsCache, ttsJobs, type TtsJob, type TtsCache, type TtsConfig } from '@shared/schema';
import { eq, and, or, desc, asc, sql } from 'drizzle-orm';
import { db } from '../db';

export interface TTSServiceInterface {
  // TTS Configuration methods
  getTTSConfig(): Promise<TtsConfig | null>;
  updateTTSConfig(config: Partial<TtsConfig>): Promise<TtsConfig>;
  
  // TTS Job methods
  getTTSJob(jobId: string): Promise<TtsJob | null>;
  createTTSJob(data: Partial<TtsJob>): Promise<TtsJob>;
  updateTTSJobStatus(jobId: string, status: string, progress?: number): Promise<TtsJob>;
  getTTSJobs(limit?: number, offset?: number): Promise<TtsJob[]>;
  
  // TTS Cache methods
  getCachedAudio(textHash: string): Promise<TtsCache | null>;
  cacheAudio(data: Partial<TtsCache>): Promise<TtsCache>;
  invalidateCache(textHash: string): Promise<void>;
}

export class TTSService implements TTSServiceInterface {
  constructor(private database: NodePgDatabase<any> = db) {}

  async getTTSConfig(): Promise<any> {
    try {
      const result = await this.database
        .select()
        .from(ttsConfig)
        .limit(1);
      
      return result[0] || null;
    } catch (error) {
      console.error('Error getting TTS config:', error);
      throw error;
    }
  }

  async updateTTSConfig(config: Partial<TtsConfig>): Promise<TtsConfig> {
    try {
      const existingConfig = await this.getTTSConfig();
      
      if (existingConfig) {
        // Update existing config
        const result = await this.database
          .update(ttsConfig)
          .set(config)
          .where(eq(ttsConfig.id, existingConfig.id))
          .returning();
        
        return result[0];
      } else {
        // Create new config
        const result = await this.database
          .insert(ttsConfig)
          .values(config)
          .returning();
        
        return result[0];
      }
    } catch (error) {
      console.error('Error updating TTS config:', error);
      throw error;
    }
  }

  async getTTSJob(jobId: string): Promise<TtsJob | null> {
    try {
      const result = await this.database
        .select()
        .from(ttsJobs)
        .where(eq(ttsJobs.id, jobId));
      
      return result[0] || null;
    } catch (error) {
      console.error('Error getting TTS job:', error);
      throw error;
    }
  }

  async createTTSJob(data: any): Promise<TtsJob> {
    try {
      const result = await this.database
        .insert(ttsJobs)
        .values(data)
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error creating TTS job:', error);
      throw error;
    }
  }

  async updateTTSJobStatus(jobId: string, status: string, progress?: number): Promise<TtsJob> {
    try {
      const updateData: any = { status };
      if (progress !== undefined) {
        updateData.progress = progress;
      }
      
      const result = await this.database
        .update(ttsJobs)
        .set(updateData)
        .where(eq(ttsJobs.id, jobId))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error updating TTS job status:', error);
      throw error;
    }
  }

  async getTTSJobs(limit: number = 50, offset: number = 0): Promise<TtsJob[]> {
    try {
      const result = await this.database
        .select()
        .from(ttsJobs)
        .orderBy(desc(ttsJobs.createdAt))
        .limit(limit)
        .offset(offset);
      
      return result;
    } catch (error) {
      console.error('Error getting TTS jobs:', error);
      throw error;
    }
  }

  async getCachedAudio(textHash: string): Promise<TtsCache | null> {
    try {
      const result = await this.database
        .select()
        .from(ttsCache)
        .where(eq(ttsCache.textHash, textHash));
      
      return result[0] || null;
    } catch (error) {
      console.error('Error getting cached audio:', error);
      throw error;
    }
  }

  async cacheAudio(data: any): Promise<TtsCache> {
    try {
      const result = await this.database
        .insert(ttsCache)
        .values(data)
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error caching audio:', error);
      throw error;
    }
  }

  async invalidateCache(textHash: string): Promise<void> {
    try {
      await this.database
        .delete(ttsCache)
        .where(eq(ttsCache.textHash, textHash));
    } catch (error) {
      console.error('Error invalidating cache:', error);
      throw error;
    }
  }
}

export const createTTSService = (database: NodePgDatabase<any> = db) => new TTSService(database);