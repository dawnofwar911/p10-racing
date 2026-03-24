import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// --- Environment Variables ---
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock-project.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';

// --- Capacitor Mocks ---
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
    getPlatform: vi.fn(() => 'web'),
  },
}));

vi.mock('@capacitor/haptics', () => ({
  Haptics: {
    impact: vi.fn(),
    notification: vi.fn(),
    selectionStart: vi.fn(),
    selectionChanged: vi.fn(),
    selectionEnd: vi.fn(),
  },
}));

vi.mock('@capacitor/status-bar', () => ({
  StatusBar: {
    setStyle: vi.fn(),
    setBackgroundColor: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
  },
}));

vi.mock('@capacitor/splash-screen', () => ({
  SplashScreen: {
    show: vi.fn(),
    hide: vi.fn(),
  },
}));

// --- Supabase / MSW Mocks ---
export const server = setupServer();

// Global console override to suppress noisy environment warnings
const originalError = console.error;
const originalWarn = console.warn;

const suppressions = [
  'Not implemented: navigation to another Document',
  'supabase.channel is not available',
  '--localstorage-file'
];

console.error = (...args) => {
  const msg = args.map(arg => arg?.toString()).join(' ');
  if (suppressions.some(s => msg.includes(s))) return;
  originalError(...args);
};

console.warn = (...args) => {
  const msg = args.map(arg => arg?.toString()).join(' ');
  if (suppressions.some(s => msg.includes(s))) return;
  originalWarn(...args);
};

// Mock window.location for JSDOM navigation suppression
if (typeof window !== 'undefined') {
  const oldLocation = window.location;
  // @ts-ignore
  delete window.location;
  // @ts-ignore
  window.location = {
    ...oldLocation,
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
    href: 'http://localhost/'
  } as unknown as Location;
}

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    length: 0,
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock window.matchMedia for some libraries (like Framer Motion)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
