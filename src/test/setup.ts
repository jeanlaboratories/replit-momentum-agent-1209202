// Set required environment variables for tests
process.env.MOMENTUM_GOOGLE_API_KEY = 'test-google-api-key-12345';

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock server-only module
vi.mock('server-only', () => ({}));

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Firebase Admin
const createMockFirestoreDoc = () => ({
  get: vi.fn(async () => ({
    exists: false,
    data: () => ({}),
    id: 'mock-id',
  })),
  set: vi.fn(async () => ({})),
  update: vi.fn(async () => ({})),
  delete: vi.fn(async () => ({})),
});

const createMockFirestoreCollection = () => ({
  doc: vi.fn(() => createMockFirestoreDoc()),
  get: vi.fn(async () => ({
    docs: [],
    empty: true,
    size: 0,
    forEach: vi.fn(),
  })),
  add: vi.fn(async () => ({ id: 'new-id' })),
  where: vi.fn(() => createMockFirestoreCollection()),
  orderBy: vi.fn(() => createMockFirestoreCollection()),
  limit: vi.fn(() => createMockFirestoreCollection()),
  startAfter: vi.fn(() => createMockFirestoreCollection()),
  offset: vi.fn(() => createMockFirestoreCollection()),
});

vi.mock('@/lib/firebase/admin', () => ({
  getAdminInstances: () => ({
    adminDb: {
      collection: vi.fn(() => createMockFirestoreCollection()),
      batch: vi.fn(() => ({
        delete: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
        commit: vi.fn(async () => ({})),
      })),
    },
  }),
}));

// Mock secure-auth
vi.mock('@/lib/secure-auth', () => ({
  getAuthenticatedUser: vi.fn(),
}));

// Mock brand-membership
vi.mock('@/lib/brand-membership', () => ({
  requireBrandAccess: vi.fn(),
  requireBrandRole: vi.fn(),
  getBrandMember: vi.fn(),
  getBrandMembers: vi.fn(),
}));

// Mock AI Assistant Context
vi.mock('@/lib/ai-assistant-context', () => ({
  getAIAssistantContext: vi.fn(async () => ({
    systemPrompt: 'Test system prompt',
    brandSoulContext: null,
    brandProfileContext: null,
  })),
}));

// Mock Brand Soul Context
vi.mock('@/lib/brand-soul/context', () => ({
  getBrandSoulContext: vi.fn(async () => null),
}));

// Mock fetch for external APIs
global.fetch = vi.fn(async () => new Response(JSON.stringify({ success: true }), { 
  status: 200,
  headers: { 'Content-Type': 'application/json' }
}));

