const mockStore = new Map<string, string>();

const mockRedis = function() {
  return {
    get: async (key: string) => {
      return mockStore.get(key) || null;
    },
    set: async (key: string, value: string) => {
      mockStore.set(key, value);
      return 'OK';
    },
    del: async (key: string) => {
      const deleted = mockStore.delete(key);
      return deleted ? 1 : 0;
    },
    on: () => {},
  };
};

jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: mockRedis,
    Redis: mockRedis,
  };
});

// Expose mockStore globally for tests to verify or clear state
(global as any).redisMockStore = mockStore;
