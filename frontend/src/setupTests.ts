import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import 'vitest-canvas-mock';
import { vi } from 'vitest';

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(() => vi.fn()),
}));

// Mock matchMedia if needed by some UI components (like Recharts)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage for Dexie hooks and other components
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn((key: string) => key === 'grainfolio_user_id' ? 'mock-user-id' : null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
});

// Mock auth hook globally so components using useAuth() don't crash without AuthProvider
vi.mock('./contexts/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'mock-user-id', email: 'test@grainfolio.app' },
    session: null,
    isLoading: false,
    isAuthTransitioning: false,
    authTransitionMode: null,
    authMode: 'supabase',
    accountRole: 'user',
    isAdmin: false,
    isDevBypass: false,
    isTrial: false,
    startTrial: vi.fn(),
    signInMock: vi.fn(),
    logout: vi.fn(),
    clearLocalAuthState: vi.fn(),
    completeSignedOutTransition: vi.fn()
  })
}));

vi.mock('./contexts/useTrialGate', () => ({
  useTrialGate: () => ({
    guardTrialResource: vi.fn(() => true),
    requireRegistration: vi.fn(),
  })
}));

vi.mock('./contexts/useLanguage', async () => {
  const { DEFAULT_LANGUAGE, translations } = await vi.importActual<typeof import('./i18n/translations')>('./i18n/translations');

  return {
    useLanguage: () => ({
      language: DEFAULT_LANGUAGE,
      setLanguage: vi.fn(),
      t: (key: keyof typeof translations[typeof DEFAULT_LANGUAGE], values: Record<string, string | number> = {}) => {
        const template = translations[DEFAULT_LANGUAGE][key] ?? key;
        return template.replace(/\{\{(\w+)\}\}/g, (_, valueKey: string) => (
          values[valueKey] === undefined ? '' : String(values[valueKey])
        ));
      },
    }),
  };
});

// Mock Supabase globally to prevent "supabaseUrl is required" error during vitest runs
vi.mock('./services/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
      resend: vi.fn().mockResolvedValue({ data: {}, error: null }),
      setSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'mock/path' }, error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'mock-signed-url' }, error: null }),
      }),
    },
  },
}));
