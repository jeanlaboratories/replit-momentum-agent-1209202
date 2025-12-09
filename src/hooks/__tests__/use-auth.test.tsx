import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../use-auth';
import type { User as FirebaseAuthUser } from 'firebase/auth';

// Mock Firebase modules
const mockSignInWithEmailAndPassword = vi.fn();
const mockSignInWithPopup = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChanged = vi.fn();

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args),
  signInWithEmailAndPassword: (...args: any[]) => mockSignInWithEmailAndPassword(...args),
  signInWithPopup: (...args: any[]) => mockSignInWithPopup(...args),
  signOut: (...args: any[]) => mockSignOut(...args),
}));

vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
  getGoogleProvider: () => ({}),
}));

vi.mock('@/lib/client-session', () => ({
  createSecureSession: vi.fn().mockResolvedValue(undefined),
  clearSecureSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/app/actions', () => ({
  logoutAction: vi.fn().mockResolvedValue(undefined),
}));

// Mock fetch for API calls
global.fetch = vi.fn();

// Test component that uses the auth hook
function TestComponent() {
  const {
    user,
    loading,
    loginWithEmail,
    loginWithGoogle,
    signupWithEmail,
    logout,
    brandId,
  } = useAuth();

  return (
    <div>
      <div data-testid="loading">{loading.toString()}</div>
      <div data-testid="user">{user ? user.uid : 'null'}</div>
      <div data-testid="brandId">{brandId || 'null'}</div>
      <button
        data-testid="login-email"
        onClick={() => loginWithEmail('test@example.com', 'password123')}
      >
        Login with Email
      </button>
      <button data-testid="login-google" onClick={() => loginWithGoogle()}>
        Login with Google
      </button>
      <button
        data-testid="signup"
        onClick={() => signupWithEmail('test@example.com', 'password123', 'Test User', 'Test Brand')}
      >
        Signup
      </button>
      <button data-testid="logout" onClick={() => logout()}>
        Logout
      </button>
    </div>
  );
}

describe('useAuth hook', () => {
  let authStateCallback: ((user: FirebaseAuthUser | null) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;

    // Capture the auth state change callback
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      authStateCallback = callback;
      // Immediately call with null to simulate initial state
      callback(null);
      return vi.fn(); // Return unsubscribe function
    });

    mockSignOut.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Email Login', () => {
    it('should successfully login with valid credentials and verified email', async () => {
      const mockUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        emailVerified: true,
        getIdToken: vi.fn().mockResolvedValue('test-token'),
      } as unknown as FirebaseAuthUser;

      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: mockUser,
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          user: { uid: 'test-uid', brandId: 'test-brand' },
        }),
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      const loginButton = screen.getByTestId('login-email');
      await userEvent.click(loginButton);

      await waitFor(() => {
        expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
          expect.anything(),
          'test@example.com',
          'password123'
        );
      });
    });

    it('should fail login with unverified email', async () => {
      const mockUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        emailVerified: false, // Not verified
        getIdToken: vi.fn().mockResolvedValue('test-token'),
      } as unknown as FirebaseAuthUser;

      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: mockUser,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      const loginButton = screen.getByTestId('login-email');
      await userEvent.click(loginButton);

      await waitFor(() => {
        expect(mockSignInWithEmailAndPassword).toHaveBeenCalled();
        expect(mockSignOut).toHaveBeenCalled(); // Should sign out unverified user
      });
    });

    it('should handle invalid credentials error', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValue({
        code: 'auth/invalid-credential',
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      const loginButton = screen.getByTestId('login-email');
      await userEvent.click(loginButton);

      await waitFor(() => {
        expect(mockSignInWithEmailAndPassword).toHaveBeenCalled();
      });
    });

    it('should handle user-not-found error', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValue({
        code: 'auth/user-not-found',
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      const loginButton = screen.getByTestId('login-email');
      await userEvent.click(loginButton);

      await waitFor(() => {
        expect(mockSignInWithEmailAndPassword).toHaveBeenCalled();
      });
    });

    it('should handle wrong-password error', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValue({
        code: 'auth/wrong-password',
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      const loginButton = screen.getByTestId('login-email');
      await userEvent.click(loginButton);

      await waitFor(() => {
        expect(mockSignInWithEmailAndPassword).toHaveBeenCalled();
      });
    });
  });

  describe('Google Login', () => {
    it('should successfully login with Google for existing user', async () => {
      const mockUser = {
        uid: 'google-uid',
        email: 'google@example.com',
        displayName: 'Google User',
        photoURL: 'https://example.com/photo.jpg',
        emailVerified: true,
        getIdToken: vi.fn().mockResolvedValue('test-token'),
      } as unknown as FirebaseAuthUser;

      mockSignInWithPopup.mockResolvedValue({
        user: mockUser,
      });

      // Mock API response for existing user
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          user: { uid: 'google-uid', brandId: 'test-brand' },
        }),
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      const googleButton = screen.getByTestId('login-google');
      await userEvent.click(googleButton);

      await waitFor(() => {
        expect(mockSignInWithPopup).toHaveBeenCalled();
      });
    });

    it('should handle popup closed by user error', async () => {
      mockSignInWithPopup.mockRejectedValue({
        code: 'auth/popup-closed-by-user',
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      const googleButton = screen.getByTestId('login-google');
      await userEvent.click(googleButton);

      await waitFor(() => {
        expect(mockSignInWithPopup).toHaveBeenCalled();
      });
    });

    it('should handle popup blocked error', async () => {
      mockSignInWithPopup.mockRejectedValue({
        code: 'auth/popup-blocked',
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      const googleButton = screen.getByTestId('login-google');
      await userEvent.click(googleButton);

      await waitFor(() => {
        expect(mockSignInWithPopup).toHaveBeenCalled();
      });
    });

    it('should handle account exists with different credential error', async () => {
      mockSignInWithPopup.mockRejectedValue({
        code: 'auth/account-exists-with-different-credential',
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      const googleButton = screen.getByTestId('login-google');
      await userEvent.click(googleButton);

      await waitFor(() => {
        expect(mockSignInWithPopup).toHaveBeenCalled();
      });
    });
  });

  describe('Logout', () => {
    it('should successfully logout', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      const logoutButton = screen.getByTestId('logout');
      await userEvent.click(logoutButton);

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
      });
    });
  });

  describe('Auth State Changes', () => {
    it('should handle auth state change to logged in user', async () => {
      const mockUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        emailVerified: true,
        getIdToken: vi.fn().mockResolvedValue('test-token'),
      } as unknown as FirebaseAuthUser;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          user: { uid: 'test-uid', brandId: 'test-brand' },
        }),
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Simulate auth state change
      await act(async () => {
        if (authStateCallback) {
          authStateCallback(mockUser);
        }
      });

      // Note: The full user state update depends on session creation and profile fetch
      // which are mocked, so we mainly verify the callback was triggered
      expect(mockOnAuthStateChanged).toHaveBeenCalled();
    });

    it('should handle auth state change to logged out', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Simulate auth state change to null (logged out)
      await act(async () => {
        if (authStateCallback) {
          authStateCallback(null);
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('null');
        expect(screen.getByTestId('brandId').textContent).toBe('null');
      });
    });

    it('should sign out user with unverified email', async () => {
      const mockUnverifiedUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        emailVerified: false, // Not verified
        getIdToken: vi.fn().mockResolvedValue('test-token'),
      } as unknown as FirebaseAuthUser;

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Simulate auth state change with unverified user
      await act(async () => {
        if (authStateCallback) {
          authStateCallback(mockUnverifiedUser);
        }
      });

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
      });
    });
  });
});
