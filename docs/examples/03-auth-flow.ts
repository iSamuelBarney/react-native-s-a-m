/**
 * Example 03: Complete Authentication Flow
 *
 * This example demonstrates a real-world authentication flow with:
 * - Login/logout handling
 * - Token storage in SecureStorage
 * - User data in Air (Warm storage)
 * - Background token refresh
 * - Saga chaining (one saga triggering others)
 */

import { Missile, Air, SecureStorage } from 'react-native-s-a-m';
import type { Action } from 'react-native-s-a-m';

const { call, put, take, fork, cancel, race, delay, takeLatest } = Missile;

// ============================================================================
// Action Types
// ============================================================================

export const AuthActions = {
  // Login flow
  LOGIN: 'auth/LOGIN',
  LOGIN_SUCCESS: 'auth/LOGIN_SUCCESS',
  LOGIN_FAILURE: 'auth/LOGIN_FAILURE',

  // Logout
  LOGOUT: 'auth/LOGOUT',
  LOGOUT_COMPLETE: 'auth/LOGOUT_COMPLETE',

  // Token refresh
  REFRESH_TOKEN: 'auth/REFRESH_TOKEN',
  REFRESH_SUCCESS: 'auth/REFRESH_SUCCESS',
  REFRESH_FAILURE: 'auth/REFRESH_FAILURE',

  // Session
  SESSION_EXPIRED: 'auth/SESSION_EXPIRED',
  CHECK_AUTH: 'auth/CHECK_AUTH',
} as const;

// ============================================================================
// Types
// ============================================================================

interface LoginPayload {
  email: string;
  password: string;
}

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

// ============================================================================
// Mock API
// ============================================================================

const authApi = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }
    return response.json();
  },

  async refreshToken(token: string): Promise<AuthResponse> {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    });
    if (!response.ok) throw new Error('Token refresh failed');
    return response.json();
  },

  async logout(token: string): Promise<void> {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};

// ============================================================================
// Worker Sagas
// ============================================================================

/**
 * Handle login attempt
 */
function* loginWorker(action: Action<LoginPayload>) {
  const { email, password } = action.payload!;

  try {
    // Set loading state
    yield call(Air.setWarm, 'auth.loading', true);
    yield call(Air.setWarm, 'auth.error', null);

    // Race between login and timeout
    const { response, timeout } = yield race({
      response: call(authApi.login, email, password),
      timeout: delay(30000), // 30 second timeout
    });

    if (timeout) {
      throw new Error('Login timed out. Please try again.');
    }

    const authResponse = response as AuthResponse;

    // Store tokens securely
    yield call(SecureStorage.set, 'accessToken', authResponse.accessToken);
    yield call(SecureStorage.set, 'refreshToken', authResponse.refreshToken);

    // Store user in Air
    yield call(Air.setWarm, 'auth.user', JSON.stringify(authResponse.user));
    yield call(Air.setWarm, 'auth.isAuthenticated', true);
    yield call(Air.setWarm, 'auth.userId', authResponse.user.id);

    // Dispatch success - other sagas can listen to this!
    yield put({
      type: AuthActions.LOGIN_SUCCESS,
      payload: authResponse.user,
    });

    // Start background token refresh
    yield fork(tokenRefreshSaga, authResponse.expiresIn);

    // Trigger other sagas to load user data
    yield put({ type: 'user/FETCH_PROFILE' });
    yield put({ type: 'cart/LOAD' });
    yield put({ type: 'notifications/SUBSCRIBE' });

  } catch (error: any) {
    yield call(Air.setWarm, 'auth.error', error.message);
    yield put({
      type: AuthActions.LOGIN_FAILURE,
      payload: error.message,
    });
  } finally {
    yield call(Air.setWarm, 'auth.loading', false);
  }
}

/**
 * Handle logout
 */
function* logoutWorker() {
  try {
    // Get token for server logout
    const accessToken = yield call(SecureStorage.get, 'accessToken');

    // Clear local state first (so UI updates immediately)
    yield call(Air.setWarm, 'auth.isAuthenticated', false);
    yield call(Air.setWarm, 'auth.user', null);
    yield call(Air.setWarm, 'auth.userId', null);

    // Clear secure storage
    yield call(SecureStorage.delete, { service: 'accessToken' });
    yield call(SecureStorage.delete, { service: 'refreshToken' });

    // Tell server to invalidate token (fire and forget)
    if (accessToken) {
      try {
        yield call(authApi.logout, accessToken);
      } catch {
        // Ignore server logout errors
      }
    }

    // Stop all user-specific watchers
    Missile.unregister('token-refresh');
    Missile.unregister('notifications');
    Missile.unregister('cart-sync');

    yield put({ type: AuthActions.LOGOUT_COMPLETE });

  } catch (error) {
    // Even if logout fails, clear local state
    console.error('Logout error:', error);
  }
}

/**
 * Background token refresh saga
 * Runs continuously to refresh the token before it expires
 */
function* tokenRefreshSaga(expiresIn: number) {
  // Refresh 5 minutes before expiry, or at 90% of lifetime
  const refreshBuffer = Math.min(5 * 60, expiresIn * 0.1);
  const refreshInterval = (expiresIn - refreshBuffer) * 1000;

  while (true) {
    // Wait until it's time to refresh
    yield delay(refreshInterval);

    try {
      const refreshToken: string = yield call(SecureStorage.get, 'refreshToken');

      if (!refreshToken) {
        // No refresh token, session expired
        yield put({ type: AuthActions.SESSION_EXPIRED });
        break;
      }

      const response: AuthResponse = yield call(authApi.refreshToken, refreshToken);

      // Update tokens
      yield call(SecureStorage.set, 'accessToken', response.accessToken);
      yield call(SecureStorage.set, 'refreshToken', response.refreshToken);

      yield put({ type: AuthActions.REFRESH_SUCCESS });

    } catch (error) {
      console.error('Token refresh failed:', error);

      // Retry once after a short delay
      yield delay(5000);

      try {
        const refreshToken: string = yield call(SecureStorage.get, 'refreshToken');
        const response: AuthResponse = yield call(authApi.refreshToken, refreshToken);
        yield call(SecureStorage.set, 'accessToken', response.accessToken);
        yield call(SecureStorage.set, 'refreshToken', response.refreshToken);
      } catch {
        // Refresh failed twice, session expired
        yield put({ type: AuthActions.SESSION_EXPIRED });
        break;
      }
    }
  }
}

/**
 * Handle session expiry
 */
function* sessionExpiredWorker() {
  // Clear auth state
  yield call(Air.setWarm, 'auth.isAuthenticated', false);
  yield call(Air.setWarm, 'auth.sessionExpired', true);

  // Clear tokens
  yield call(SecureStorage.delete, { service: 'accessToken' });
  yield call(SecureStorage.delete, { service: 'refreshToken' });

  // Stop background tasks
  Missile.unregisterAll();
}

/**
 * Check authentication on app start
 */
function* checkAuthWorker() {
  try {
    const accessToken: string | null = yield call(SecureStorage.get, 'accessToken');
    const refreshToken: string | null = yield call(SecureStorage.get, 'refreshToken');

    if (!accessToken || !refreshToken) {
      yield call(Air.setWarm, 'auth.isAuthenticated', false);
      yield call(Air.setWarm, 'auth.checked', true);
      return;
    }

    // Try to refresh the token to validate it
    try {
      const response: AuthResponse = yield call(authApi.refreshToken, refreshToken);

      yield call(SecureStorage.set, 'accessToken', response.accessToken);
      yield call(SecureStorage.set, 'refreshToken', response.refreshToken);

      yield call(Air.setWarm, 'auth.user', JSON.stringify(response.user));
      yield call(Air.setWarm, 'auth.isAuthenticated', true);
      yield call(Air.setWarm, 'auth.userId', response.user.id);

      // Start token refresh
      yield fork(tokenRefreshSaga, response.expiresIn);

    } catch {
      // Token invalid, clear everything
      yield call(SecureStorage.delete, { service: 'accessToken' });
      yield call(SecureStorage.delete, { service: 'refreshToken' });
      yield call(Air.setWarm, 'auth.isAuthenticated', false);
    }

    yield call(Air.setWarm, 'auth.checked', true);

  } catch (error) {
    console.error('Auth check failed:', error);
    yield call(Air.setWarm, 'auth.isAuthenticated', false);
    yield call(Air.setWarm, 'auth.checked', true);
  }
}

// ============================================================================
// Watcher Saga
// ============================================================================

export function* authWatcher() {
  yield takeLatest(AuthActions.LOGIN, loginWorker);
  yield takeLatest(AuthActions.LOGOUT, logoutWorker);
  yield takeLatest(AuthActions.SESSION_EXPIRED, sessionExpiredWorker);
  yield takeLatest(AuthActions.CHECK_AUTH, checkAuthWorker);
}

// ============================================================================
// App Setup
// ============================================================================

/**
 * Initialize auth on app start
 */
export function initializeAuth() {
  // Register the auth watcher
  Missile.register('auth-watcher', authWatcher);

  // Check if user is already authenticated
  Missile.dispatch({ type: AuthActions.CHECK_AUTH });
}

// ============================================================================
// Usage in Components
// ============================================================================

/**
 * Login Screen Component (pseudo-code)
 */
function LoginScreen() {
  // const [error, setError] = useState<string | null>(null);
  // const [loading, setLoading] = useState(false);
  //
  // // Watch auth state
  // useWarm({ keys: ['auth.loading', 'auth.error', 'auth.isAuthenticated'] }, (event) => {
  //   if (event.key === 'auth.loading') setLoading(event.newValue as boolean);
  //   if (event.key === 'auth.error') setError(event.newValue as string);
  //   if (event.key === 'auth.isAuthenticated' && event.newValue) {
  //     navigation.navigate('Home');
  //   }
  // });
  //
  // const handleLogin = (email: string, password: string) => {
  //   Missile.dispatch({
  //     type: AuthActions.LOGIN,
  //     payload: { email, password },
  //   });
  // };
}

/**
 * App Root Component (pseudo-code)
 */
function App() {
  // useEffect(() => {
  //   initializeAuth();
  // }, []);
  //
  // Watch for session expiry globally
  // useWarm({ keys: ['auth.sessionExpired'] }, (event) => {
  //   if (event.newValue === true) {
  //     Alert.alert('Session Expired', 'Please log in again');
  //     navigation.reset({ routes: [{ name: 'Login' }] });
  //   }
  // });
}

// ============================================================================
// Key Takeaways
// ============================================================================

/**
 * 1. Use SecureStorage for tokens, Air for user state
 * 2. Race with timeout for network requests
 * 3. Fork background tasks (token refresh)
 * 4. Chain actions - login success triggers profile fetch, cart load, etc.
 * 5. Handle session expiry gracefully
 * 6. Check auth on app startup
 * 7. Clean up (unregisterAll) on logout
 * 8. Components watch Air state, dispatch actions
 */

export { loginWorker, logoutWorker, tokenRefreshSaga };
