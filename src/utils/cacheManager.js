// utils/cacheManager.js
import { Video } from '../models/video.model.js';
import redisClient from './redisClient.js';

class CacheManager {
    constructor() {
        this.DEFAULT_EXPIRATION = 60; 
        this.EXTENDED_EXPIRATION = 120; 
    }

    //generating cache key
    keys = {
        videoList: (params = {}) => {
            const { page = 1, limit = 10, query = '', sortBy = '', sortType = '', userId = '' } = params;
            return `videos:list:${page}:${limit}:${query}:${sortBy}:${sortType}:${userId}`;
        },
        videoDetail: (videoId, userId) => `videos:detail:${videoId}:${userId || ''}`,
        userVideos: (userId) => `videos:user:${userId}`,

        tweetList: (userId) => `tweets:list:${userId}`,
        tweetDetail: (tweetId) => `tweets:detail:${tweetId}`,
        userTweets: (userId) => `tweets:user:${userId}`,

        likelist: (userId) => `likes:list:${userId}`,
        userlikes: (userId) => `likes:user:${userId}`,
    };

    //for bulk deletion
    patterns = {
        allVideos: 'videos:*',
        userVideos: (userId) => `videos:*:${userId}*`,
        allTweets: 'tweets:*',
        userTweets: (userId) => `tweets:*:${userId}*`,
        userSpecific: (userId) => `*:*:${userId}*`,
        allLikes: 'likes:*',
        userlikes: (userId) => `likes:*:${userId}`,
    };

    async get(key) {
        try {
            const data = await redisClient.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }

    async set(key, data, expiration = this.DEFAULT_EXPIRATION) {
        try {
            await redisClient.setex(key, expiration, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Cache set error:', error);
            return false;
        }
    }

    async del(key) {
        try {
            await redisClient.del(key);
            return true;
        } catch (error) {
            console.error('Cache delete error:', error);
            return false;
        }
    }

    async clearByPattern(pattern) {
        try {
            const keys = await redisClient.keys(pattern);
            if (keys.length > 0) {
                await redisClient.del(keys);
            }
            return true;
        } catch (error) {
            console.error('Cache pattern clear error:', error);
            return false;
        }
    }

    async clearVideoCache(videoId, userId) {
        const patterns = [
            this.patterns.allVideos,
            this.patterns.userVideos(userId),
            this.keys.videoDetail(videoId, userId)
        ];

        for (const pattern of patterns) {
            await this.clearByPattern(pattern);
        }
    }

    async clearTweetCache(userId) {
        const patterns = [
            this.patterns.userTweets(userId),
            this.keys.tweetList(userId)
        ];

        for (const pattern of patterns) {
            await this.clearByPattern(pattern);
        }
    }

    async clearLikesCache(userId) {
        const patterns = [
            this.patterns.userlikes(userId),
            this.keys.likelist(userId)
        ];

        for(const pattern of patterns){
            await this.clearByPattern(pattern);
        }
    }
}

export const cacheManager = new CacheManager();