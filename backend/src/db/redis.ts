import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

let redisInstance: any;

if (process.env.USE_MOCK_REDIS === 'true') {
  console.log('⚠️  [Redis] Running in-memory mock client (USE_MOCK_REDIS=true or NODE_ENV=test)');
  const mockStore = new Map<string, string>();
  redisInstance = {
    get: async (key: string) => {
      const val = mockStore.get(key) || null;
      console.log(`[Mock Redis] GET ${key} -> ${val}`);
      return val;
    },
    set: async (key: string, value: string) => {
      console.log(`[Mock Redis] SET ${key} = ${value}`);
      mockStore.set(key, value);
      return 'OK';
    },
    del: async (key: string) => {
      const deleted = mockStore.delete(key);
      console.log(`[Mock Redis] DEL ${key} -> ${deleted ? 1 : 0}`);
      return deleted ? 1 : 0;
    },
    on: (event: string, handler: Function) => {
      console.log(`[Mock Redis] Registered event listener for: ${event}`);
    },
  };
} else {
  redisInstance = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    maxRetriesPerRequest: null,
  });
}

export const redis = redisInstance;
