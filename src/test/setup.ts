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
vi.mock('@/lib/firebase/admin', () => ({
  getAdminInstances: () => ({
    adminDb: {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({
            doc: vi.fn(() => ({
              get: vi.fn(),
              add: vi.fn(),
              update: vi.fn(),
              delete: vi.fn(),
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => ({
                  get: vi.fn(),
                })),
                startAfter: vi.fn(() => ({
                  get: vi.fn(),
                })),
              })),
            })),
            get: vi.fn(),
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({
                get: vi.fn(),
              })),
              startAfter: vi.fn(() => ({
                get: vi.fn(),
              })),
            })),
          })),
        })),
      })),
      batch: vi.fn(() => ({
        delete: vi.fn(),
        commit: vi.fn(),
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
}));

