// lib/redis.ts
import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      throw new Error('REDIS_URL is not defined in environment variables');
    }
    
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
    
    redis.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });
    
    redis.on('connect', () => {
      console.log('✅ Connected to Redis');
    });
  }
  
  return redis;
}

// Feedback data structure
export interface Feedback {
  id: string;
  matchId: string;
  rallyNumber: number;
  setNumber: number;
  rating: 1 | 2 | 3 | 4 | 5;
  userNickname: string;
  originalCommentary: string;
  userSuggestion?: string; // Required for rating 1-3
  userComment?: string; // Optional for rating 4-5
  timestamp: string;
}

// Helper functions for feedback operations
export async function saveFeedback(feedback: Feedback): Promise<void> {
  const client = getRedisClient();
  
  // Store in Redis with key: feedback:{id}
  const key = `feedback:${feedback.id}`;
  await client.set(key, JSON.stringify(feedback));
  
  // Add to sorted set for easy retrieval (sorted by timestamp)
  await client.zadd('feedback:all', Date.parse(feedback.timestamp), feedback.id);
  
  // Index by match for filtering
  await client.sadd(`feedback:match:${feedback.matchId}`, feedback.id);
  
  // Index by user for filtering
  await client.sadd(`feedback:user:${feedback.userNickname}`, feedback.id);
  
  // Index by rating for filtering
  await client.sadd(`feedback:rating:${feedback.rating}`, feedback.id);
}

export async function getAllFeedback(limit = 100, offset = 0): Promise<Feedback[]> {
  const client = getRedisClient();
  
  // Get feedback IDs from sorted set (newest first)
  const feedbackIds = await client.zrevrange('feedback:all', offset, offset + limit - 1);
  
  if (feedbackIds.length === 0) {
    return [];
  }
  
  // Get all feedback objects
  const feedbackKeys = feedbackIds.map(id => `feedback:${id}`);
  const feedbackData = await client.mget(...feedbackKeys);
  
  return feedbackData
    .filter((data): data is string => data !== null)
    .map(data => JSON.parse(data) as Feedback);
}

export async function getFeedbackByMatch(matchId: string): Promise<Feedback[]> {
  const client = getRedisClient();
  
  // Get feedback IDs for this match
  const feedbackIds = await client.smembers(`feedback:match:${matchId}`);
  
  if (feedbackIds.length === 0) {
    return [];
  }
  
  // Get all feedback objects
  const feedbackKeys = feedbackIds.map(id => `feedback:${id}`);
  const feedbackData = await client.mget(...feedbackKeys);
  
  return feedbackData
    .filter((data): data is string => data !== null)
    .map(data => JSON.parse(data) as Feedback)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

export async function getFeedbackByRating(rating: 1 | 2 | 3 | 4 | 5): Promise<Feedback[]> {
  const client = getRedisClient();
  
  const feedbackIds = await client.smembers(`feedback:rating:${rating}`);
  
  if (feedbackIds.length === 0) {
    return [];
  }
  
  const feedbackKeys = feedbackIds.map(id => `feedback:${id}`);
  const feedbackData = await client.mget(...feedbackKeys);
  
  return feedbackData
    .filter((data): data is string => data !== null)
    .map(data => JSON.parse(data) as Feedback)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

export async function getFeedbackStats(): Promise<{
  total: number;
  byRating: Record<number, number>;
  uniqueUsers: number;
}> {
  const client = getRedisClient();
  
  const total = await client.zcard('feedback:all');
  
  const byRating: Record<number, number> = {};
  for (let rating = 1; rating <= 5; rating++) {
    byRating[rating] = await client.scard(`feedback:rating:${rating}`);
  }
  
  // Count unique users (approximate - get all user keys)
  const userKeys = await client.keys('feedback:user:*');
  const uniqueUsers = userKeys.length;
  
  return {
    total,
    byRating,
    uniqueUsers,
  };
}
