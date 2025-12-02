# Missile - Action & Saga System

> **Status:** Design Draft - Not Yet Implemented

## Overview

Missile is a lightweight action dispatcher for S.A.M. One function, works everywhere.

```typescript
import { Missile } from 'react-native-s-a-m';

// That's it. Use anywhere - components, utilities, interceptors, anywhere.
Missile.dispatch({ type: 'auth/LOGIN', payload: { email, password } });

// Optional status for tracking action lifecycle
Missile.dispatch({ type: 'auth/LOGIN', payload: { email, password }, status: 'pending' });
```

## Why Missile?

- **One function** - `Missile.dispatch()` works anywhere, no hooks required
- **No boilerplate** - No providers, no context, no setup
- **Sagas handle logic** - Components stay dumb, business logic lives in sagas
- **Works outside React** - Use in API interceptors, navigation, utilities

---

## Quick Reference

```typescript
import { Missile } from 'react-native-s-a-m';

// Dispatch actions anywhere
Missile.dispatch({ type: 'ACTION', payload: data });

// Start a saga
Missile.runSaga(mySaga);

// Named saga management
Missile.register('name', saga);     // Start by name
Missile.unregister('name');         // Stop by name
Missile.isRegistered('name');       // Check if running
Missile.unregisterAll();            // Stop all named sagas

// Effects (use inside sagas)
const { call, put, take, delay, fork, spawn, cancel, race, all,
        takeEvery, takeLatest, debounce, throttle, channel } = Missile;
```

---

## Quick Start

### 1. Define Your Actions (Optional but Recommended)

```typescript
// actions/auth.ts
export const AuthActions = {
  LOGIN: 'auth/LOGIN',
  LOGIN_SUCCESS: 'auth/LOGIN_SUCCESS',
  LOGIN_FAILURE: 'auth/LOGIN_FAILURE',
  LOGOUT: 'auth/LOGOUT',
} as const;

// Type helpers (optional)
export type LoginPayload = { email: string; password: string };
export type LoginSuccessPayload = { user: User };
export type LoginFailurePayload = { error: string };
```

### 2. Create Sagas to Handle Actions

```typescript
// sagas/auth.ts
import { Missile, Air, SecureStorage } from 'react-native-s-a-m';
const { takeLatest, call, put } = Missile;
import { AuthActions } from '../actions/auth';

function* handleLogin(action) {
  const { email, password } = action.payload;

  try {
    const response = yield call(authApi.login, email, password);

    // Store tokens securely
    yield call(SecureStorage.set, 'accessToken', response.accessToken);

    // Store user in Warm storage
    yield call(Air.setWarm, 'user.profile', JSON.stringify(response.user));
    yield call(Air.setWarm, 'user.isAuthenticated', true);

    yield put({ type: AuthActions.LOGIN_SUCCESS, payload: { user: response.user } });
  } catch (error) {
    yield put({ type: AuthActions.LOGIN_FAILURE, payload: { error: error.message } });
  }
}

function* handleLogout() {
  yield call(SecureStorage.delete, { service: 'auth' });
  yield call(Air.setWarm, 'user.isAuthenticated', false);
}

export function* authSaga() {
  yield takeLatest(AuthActions.LOGIN, handleLogin);
  yield takeLatest(AuthActions.LOGOUT, handleLogout);
}
```

### 3. Register Sagas at App Start

```typescript
// App.tsx
import { Missile } from 'react-native-s-a-m';
import { authSaga } from './sagas/auth';
import { cartSaga } from './sagas/cart';

// Register all sagas once at startup
Missile.runSaga(authSaga);
Missile.runSaga(cartSaga);
```

### 4. Dispatch Actions Anywhere

```typescript
// In a component
import { Missile } from 'react-native-s-a-m';
import { AuthActions } from '../actions/auth';

function LoginButton() {
  const handlePress = () => {
    Missile.dispatch({
      type: AuthActions.LOGIN,
      payload: { email: 'user@example.com', password: 'secret' }
    });
  };

  return <Button onPress={handlePress} title="Login" />;
}
```

```typescript
// In an API interceptor (outside React)
import { Missile } from 'react-native-s-a-m';

axios.interceptors.response.use(null, (error) => {
  if (error.response?.status === 401) {
    Missile.dispatch({ type: 'auth/LOGOUT' });
  }
  return Promise.reject(error);
});
```

```typescript
// In a navigation handler
import { Missile } from 'react-native-s-a-m';

navigation.addListener('beforeRemove', () => {
  Missile.dispatch({ type: 'analytics/SCREEN_EXIT', payload: { screen: 'Home' } });
});
```

---

## API Reference

### Missile.dispatch(action)

Dispatches an action to all registered sagas.

```typescript
import { Missile } from 'react-native-s-a-m';

Missile.dispatch({
  type: string,        // Required - action type identifier
  payload?: any,       // Optional - action data
  status?: string      // Optional - action status (e.g., 'pending', 'success', 'error')
});
```

Works anywhere - components, utilities, interceptors, event handlers. No hooks, no context.

The `status` property is useful for:
- Tracking action lifecycle (`'pending'` → `'success'` / `'error'`)
- Filtering actions in sagas based on status
- Debugging and logging

### Missile.runSaga(saga)

Registers a saga to listen for actions.

```typescript
import { Missile } from 'react-native-s-a-m';

Missile.runSaga(mySaga);
```

Call once at app startup. Returns a task that can be cancelled.

### Missile Effects

Effects are yielded inside sagas to perform operations. Import via destructuring:

```typescript
import { Missile } from 'react-native-s-a-m';
const { call, put, take, takeEvery, takeLatest, fork, cancel, race, all, delay, debounce, throttle } = Missile;
```

| Effect | Description | Example |
|--------|-------------|---------|
| `call` | Call a function (blocking) | `yield call(api.login, email, pw)` |
| `put` | Dispatch another action | `yield put({ type: 'SUCCESS' })` |
| `take` | Wait for specific action | `yield take('LOGIN_SUCCESS')` |
| `takeEvery` | Handle every matching action | `yield takeEvery('FETCH', handler)` |
| `takeLatest` | Handle latest only (cancel prev) | `yield takeLatest('SEARCH', handler)` |
| `fork` | Non-blocking call | `yield fork(backgroundSync)` |
| `cancel` | Cancel a forked task | `yield cancel(task)` |
| `race` | First to complete wins | `yield race({ res, timeout })` |
| `all` | Wait for all to complete | `yield all([task1, task2])` |
| `delay` | Wait for duration | `yield delay(1000)` |
| `debounce` | Debounce handler | `yield debounce(500, 'SEARCH', fn)` |
| `throttle` | Throttle handler | `yield throttle(1000, 'SCROLL', fn)` |
| `spawn` | Detached fork (errors don't propagate) | `yield spawn(analyticsSaga)` |
| `channel` | Create a channel for saga communication | `const ch = channel()` |
| `resolve` | Return a value immediately | `yield resolve(defaultValue)` |
| `reject` | Throw an error immediately | `yield reject(new Error('fail'))` |

---

## Sagas: Watchers & Workers

Sagas are generator functions that handle your business logic. There are two types:

### Watchers vs Workers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Saga Structure                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   WATCHER (listener)              WORKER (handler)                       │
│   ──────────────────              ────────────────                       │
│   • Listens for actions           • Contains business logic              │
│   • Routes to workers             • Calls APIs, updates storage          │
│   • Uses takeEvery/takeLatest     • Dispatches result actions            │
│   • Runs forever                  • Runs once per action                 │
│                                                                          │
│   function* authWatcher() {       function* loginWorker(action) {        │
│     yield takeLatest(               const { email, pw } = action.payload │
│       'LOGIN',                      const user = yield call(api.login)   │
│       loginWorker  ──────────────►  yield call(Air.setWarm, 'user', user)│
│     );                              yield put({ type: 'LOGIN_SUCCESS' }) │
│   }                               }                                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Watcher** = Listens for specific action types and delegates to workers
**Worker** = Does the actual work (API calls, storage updates, etc.)

### Writing a Watcher

A watcher is a generator that runs forever, listening for actions:

```typescript
// sagas/auth.ts
import { Missile } from 'react-native-s-a-m';
const { takeLatest, takeEvery } = Missile;

// This is a WATCHER - it listens and delegates
export function* authWatcher() {
  // takeLatest: Only handle the most recent LOGIN (cancels previous)
  yield takeLatest('auth/LOGIN', loginWorker);

  // takeEvery: Handle every LOGOUT (no cancellation)
  yield takeEvery('auth/LOGOUT', logoutWorker);
}
```

### Writing a Worker

A worker contains your business logic. It receives the action and does the work:

```typescript
// This is a WORKER - it does the actual work
function* loginWorker(action) {
  const { email, password } = action.payload;

  try {
    // 1. Call API
    const response = yield call(authApi.login, email, password);

    // 2. Update storage
    yield call(Air.setWarm, 'auth.user', JSON.stringify(response.user));
    yield call(Air.setWarm, 'auth.isAuthenticated', true);

    // 3. Dispatch success action (other sagas can listen to this)
    yield put({ type: 'auth/LOGIN_SUCCESS', payload: response.user });

  } catch (error) {
    // 4. Handle errors
    yield call(Air.setWarm, 'auth.error', error.message);
    yield put({ type: 'auth/LOGIN_FAILURE', payload: error.message });
  }
}

function* logoutWorker() {
  yield call(SecureStorage.delete, { service: 'auth' });
  yield call(Air.setWarm, 'auth.isAuthenticated', false);
  yield call(Air.setWarm, 'auth.user', null);
}
```

### Registering Sagas

Register your watchers at app startup:

```typescript
// App.tsx or index.js
import { Missile } from 'react-native-s-a-m';
import { authWatcher } from './sagas/auth';
import { cartWatcher } from './sagas/cart';
import { productWatcher } from './sagas/products';

// Register each watcher - they'll run in parallel
Missile.runSaga(authWatcher);
Missile.runSaga(cartWatcher);
Missile.runSaga(productWatcher);
```

Or create a root saga that combines them:

```typescript
// sagas/index.ts
import { Missile } from 'react-native-s-a-m';
const { all, fork } = Missile;
import { authWatcher } from './auth';
import { cartWatcher } from './cart';
import { productWatcher } from './products';

export function* rootSaga() {
  yield all([
    fork(authWatcher),
    fork(cartWatcher),
    fork(productWatcher),
  ]);
}

// App.tsx
import { Missile } from 'react-native-s-a-m';
import { rootSaga } from './sagas';

Missile.runSaga(rootSaga);
```

### Choosing takeEvery vs takeLatest

| Effect | Behavior | Use When |
|--------|----------|----------|
| `takeEvery` | Handles every action, even if previous is still running | Logging, analytics, independent operations |
| `takeLatest` | Cancels previous, only runs latest | Search, form submit, fetching data |
| `debounce` | Waits for pause in actions before handling | Search-as-you-type, auto-save |
| `throttle` | Handles at most once per time period | Scroll events, resize handlers |

```typescript
function* searchWatcher() {
  // User types fast - only search after they pause for 300ms
  yield debounce(300, 'search/QUERY', searchWorker);
}

function* scrollWatcher() {
  // Don't fire more than once per 100ms during scroll
  yield throttle(100, 'ui/SCROLL', handleScroll);
}

function* analyticsWatcher() {
  // Log every single event, never skip
  yield takeEvery('analytics/*', logEvent);
}

function* fetchWatcher() {
  // Cancel previous fetch if user requests new data
  yield takeLatest('data/FETCH', fetchWorker);
}
```

### Saga File Organization

Recommended project structure:

```
src/
├── sagas/
│   ├── index.ts        # Root saga (combines all watchers)
│   ├── auth.ts         # Auth watcher + workers
│   ├── cart.ts         # Cart watcher + workers
│   ├── products.ts     # Products watcher + workers
│   └── analytics.ts    # Analytics watcher + workers
├── actions/
│   ├── index.ts        # Typed dispatch helper
│   ├── auth.ts         # Auth action types
│   ├── cart.ts         # Cart action types
│   └── products.ts     # Product action types
└── ...
```

Example complete saga file:

```typescript
// sagas/cart.ts
import { Missile, Air } from 'react-native-s-a-m';
const { takeEvery, takeLatest, debounce, call, put, fork } = Missile;
import { CartActions } from '../actions/cart';

// ============ WORKERS (business logic) ============

function* addItemWorker(action) {
  const { productId, quantity } = action.payload;

  // Get current cart
  const cartJson = yield call(Air.getWarm, 'cart.items');
  const cart = cartJson ? JSON.parse(cartJson) : [];

  // Add or update item
  const index = cart.findIndex(item => item.productId === productId);
  if (index >= 0) {
    cart[index].quantity += quantity;
  } else {
    cart.push({ productId, quantity });
  }

  // Save cart
  yield call(Air.setWarm, 'cart.items', JSON.stringify(cart));
  yield call(Air.setWarm, 'cart.count', cart.length);

  // Trigger background sync
  yield put({ type: CartActions.SYNC });
}

function* removeItemWorker(action) {
  const { productId } = action.payload;

  const cartJson = yield call(Air.getWarm, 'cart.items');
  const cart = cartJson ? JSON.parse(cartJson) : [];

  const filtered = cart.filter(item => item.productId !== productId);

  yield call(Air.setWarm, 'cart.items', JSON.stringify(filtered));
  yield call(Air.setWarm, 'cart.count', filtered.length);
  yield put({ type: CartActions.SYNC });
}

function* syncWorker() {
  const cartJson = yield call(Air.getWarm, 'cart.items');
  const cart = cartJson ? JSON.parse(cartJson) : [];

  try {
    yield call(cartApi.sync, cart);
  } catch (error) {
    console.warn('Cart sync failed, will retry later');
  }
}

function* checkoutWorker() {
  yield call(Air.setWarm, 'cart.checkoutLoading', true);

  try {
    const cartJson = yield call(Air.getWarm, 'cart.items');
    const cart = JSON.parse(cartJson);

    const order = yield call(orderApi.create, cart);

    // Clear cart after successful checkout
    yield call(Air.setWarm, 'cart.items', '[]');
    yield call(Air.setWarm, 'cart.count', 0);

    yield put({ type: CartActions.CHECKOUT_SUCCESS, payload: order });

  } catch (error) {
    yield call(Air.setWarm, 'cart.error', error.message);
    yield put({ type: CartActions.CHECKOUT_FAILURE, payload: error.message });
  } finally {
    yield call(Air.setWarm, 'cart.checkoutLoading', false);
  }
}

// ============ WATCHER (listener) ============

export function* cartWatcher() {
  yield takeEvery(CartActions.ADD_ITEM, addItemWorker);
  yield takeEvery(CartActions.REMOVE_ITEM, removeItemWorker);
  yield debounce(1000, CartActions.SYNC, syncWorker);  // Debounce sync by 1s
  yield takeLatest(CartActions.CHECKOUT, checkoutWorker);
}
```

### Dynamic Watcher Registration

Watchers can be started and stopped at any time using `Missile.register()` and `Missile.unregister()`. This is useful for:
- Starting watchers when navigating to a screen
- Stopping watchers when leaving a screen
- Conditionally enabling/disabling features
- Cleaning up on logout

```typescript
import { Missile } from 'react-native-s-a-m';
import { cartWatcher } from '../sagas/cart';
import { checkoutWatcher } from '../sagas/checkout';

// Start a watcher with a name
Missile.register('cart-watcher', cartWatcher);

// Stop it by name
Missile.unregister('cart-watcher');

// Check if running
if (Missile.isRegistered('cart-watcher')) {
  console.log('Cart watcher is active');
}

// Get all registered names
const names = Missile.getRegisteredNames();
// ['cart-watcher', 'auth-watcher', ...]

// Stop all watchers (e.g., on logout)
Missile.unregisterAll();
```

**React Navigation Example:**

```typescript
import { useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Missile } from 'react-native-s-a-m';
import { checkoutWatcher } from '../sagas/checkout';

function CheckoutScreen() {
  // Start watcher when screen is focused, stop when unfocused
  useFocusEffect(
    useCallback(() => {
      Missile.register('checkout-watcher', checkoutWatcher);

      return () => {
        Missile.unregister('checkout-watcher');
      };
    }, [])
  );

  return <CheckoutForm />;
}
```

**Conditional Registration Based on Storage:**

```typescript
import { Missile, Air, useWarm } from 'react-native-s-a-m';
import { premiumWatcher } from '../sagas/premium';

function App() {
  // Watch for premium status changes
  useWarm({ keys: ['user.isPremium'] }, (event) => {
    if (event.newValue === true) {
      // User upgraded - start premium features
      Missile.register('premium-watcher', premiumWatcher);
    } else {
      // User downgraded - stop premium features
      Missile.unregister('premium-watcher');
    }
  });

  return <MainApp />;
}
```

**Auth Flow Example:**

```typescript
// On login success, start user-specific watchers
function* loginWorker(action) {
  const user = yield call(authApi.login, action.payload);

  // Store user
  yield call(Air.setWarm, 'auth.user', JSON.stringify(user));

  // Dynamically register watchers for this user
  Missile.register('user-sync', userSyncWatcher);
  Missile.register('notifications', notificationWatcher);
  Missile.register('cart-sync', cartSyncWatcher);
}

// On logout, clean up all user-specific watchers
function* logoutWorker() {
  // Clear auth state
  yield call(Air.setWarm, 'auth.user', null);

  // Stop all user-specific watchers
  Missile.unregister('user-sync');
  Missile.unregister('notifications');
  Missile.unregister('cart-sync');

  // Or just stop all of them
  // Missile.unregisterAll();
}
```

**API Summary:**

| Method | Description |
|--------|-------------|
| `Missile.register(name, saga, ...args)` | Start a named saga (stops existing with same name) |
| `Missile.unregister(name)` | Stop a named saga |
| `Missile.isRegistered(name)` | Check if a named saga is running |
| `Missile.getRegistered(name)` | Get the Task for a named saga |
| `Missile.getRegisteredNames()` | Get all registered saga names |
| `Missile.unregisterAll()` | Stop all named sagas |

### Advanced: Forking Background Tasks

Workers can spawn long-running background tasks:

```typescript
function* loginWorker(action) {
  const response = yield call(authApi.login, action.payload);

  // Store user
  yield call(Air.setWarm, 'auth.user', JSON.stringify(response.user));

  // Fork a background task (non-blocking)
  yield fork(tokenRefreshLoop);
  yield fork(syncUserDataPeriodically);

  yield put({ type: 'auth/LOGIN_SUCCESS' });
}

// This runs in the background after login
function* tokenRefreshLoop() {
  while (true) {
    yield delay(55 * 60 * 1000); // Wait 55 minutes

    try {
      const token = yield call(SecureStorage.get, 'refreshToken');
      const newToken = yield call(authApi.refresh, token);
      yield call(SecureStorage.set, 'accessToken', newToken);
    } catch {
      yield put({ type: 'auth/LOGOUT' });
      break; // Exit loop on failure
    }
  }
}
```

### Watching Storage Instead of Actions

Watchers don't have to listen for actions - they can also watch Warm storage values and react to changes:

```typescript
// sagas/sync.ts
import { Missile, Air } from 'react-native-s-a-m';
const { call, put, fork, take } = Missile;

// This watcher monitors storage changes, not actions
export function* storageSyncWatcher() {
  // Watch for changes to auth state
  yield fork(watchAuthState);

  // Watch for changes to cart
  yield fork(watchCartChanges);

  // Watch for network status
  yield fork(watchNetworkStatus);
}

function* watchAuthState() {
  // Subscribe to Warm storage changes
  const channel = yield call(Air.watchWarm, 'auth.isAuthenticated');

  while (true) {
    const event = yield take(channel);

    if (event.newValue === true) {
      // User just logged in - sync their data
      yield put({ type: 'sync/PULL_USER_DATA' });
    } else if (event.newValue === false) {
      // User just logged out - clear local caches
      yield put({ type: 'sync/CLEAR_CACHES' });
    }
  }
}

function* watchCartChanges() {
  const channel = yield call(Air.watchWarm, 'cart.items');

  while (true) {
    const event = yield take(channel);

    // Cart changed - queue a background sync
    if (event.newValue) {
      yield put({ type: 'cart/SYNC' });
    }
  }
}

function* watchNetworkStatus() {
  const channel = yield call(Air.watchWarm, 'network.isOnline');

  while (true) {
    const event = yield take(channel);

    if (event.newValue === true && event.oldValue === false) {
      // Just came back online - sync pending changes
      yield put({ type: 'sync/FLUSH_PENDING' });
    }
  }
}
```

**When to use storage watchers vs action watchers:**

| Watch Storage | Watch Actions |
|---------------|---------------|
| React to state changes from anywhere | React to explicit user/system intents |
| Don't care *how* value changed | Need to know *why* action was dispatched |
| Cross-cutting concerns (sync, analytics) | Feature-specific logic |
| Example: "Whenever cart changes, sync it" | Example: "When user clicks checkout, process order" |

**Combined example - analytics that watches both:**

```typescript
// sagas/analytics.ts
export function* analyticsWatcher() {
  // Watch explicit analytics actions
  yield takeEvery('analytics/TRACK', trackEventWorker);

  // Also watch storage for implicit events
  yield fork(watchImplicitEvents);
}

function* watchImplicitEvents() {
  // Watch multiple storage keys
  const authChannel = yield call(Air.watchWarm, 'auth.isAuthenticated');
  const cartChannel = yield call(Air.watchWarm, 'cart.count');

  yield fork(function* () {
    while (true) {
      const event = yield take(authChannel);
      if (event.newValue === true) {
        yield call(analyticsService.track, 'user_logged_in');
      } else if (event.newValue === false) {
        yield call(analyticsService.track, 'user_logged_out');
      }
    }
  });

  yield fork(function* () {
    while (true) {
      const event = yield take(cartChannel);
      yield call(analyticsService.track, 'cart_updated', {
        count: event.newValue,
        previousCount: event.oldValue,
      });
    }
  });
}
```

### Chaining Actions with `put`

Use `put` to dispatch actions from within a worker. This lets sagas communicate with each other:

```typescript
// sagas/auth.ts
import { Missile, Air, SecureStorage } from 'react-native-s-a-m';
const { call, put, takeLatest, takeEvery } = Missile;

function* loginWorker(action) {
  const { email, password } = action.payload;

  try {
    const response = yield call(authApi.login, email, password);

    // Store auth data
    yield call(Air.setWarm, 'auth.user', JSON.stringify(response.user));
    yield call(Air.setWarm, 'auth.isAuthenticated', true);

    // Dispatch LOGIN_SUCCESS - other watchers can listen to this!
    yield put({ type: 'auth/LOGIN_SUCCESS', payload: response.user });

    // Dispatch action to fetch user's data (handled by another saga)
    yield put({ type: 'user/FETCH_PROFILE' });

    // Dispatch action to load user's cart (handled by cart saga)
    yield put({ type: 'cart/LOAD' });

    // Dispatch analytics event (handled by analytics saga)
    yield put({ type: 'analytics/TRACK', payload: { event: 'login', userId: response.user.id } });

  } catch (error) {
    yield put({ type: 'auth/LOGIN_FAILURE', payload: error.message });
  }
}

// sagas/user.ts - This watcher picks up the FETCH_PROFILE action
export function* userWatcher() {
  yield takeLatest('user/FETCH_PROFILE', fetchProfileWorker);
}

function* fetchProfileWorker() {
  const userJson = yield call(Air.getWarm, 'auth.user');
  const user = JSON.parse(userJson);

  const profile = yield call(userApi.getProfile, user.id);
  yield call(Air.setWarm, 'user.profile', JSON.stringify(profile));

  // Chain another action
  yield put({ type: 'user/FETCH_PREFERENCES' });
}

// sagas/cart.ts - This watcher picks up the LOAD action
export function* cartWatcher() {
  yield takeLatest('cart/LOAD', loadCartWorker);
}

function* loadCartWorker() {
  const userJson = yield call(Air.getWarm, 'auth.user');
  const user = JSON.parse(userJson);

  const cart = yield call(cartApi.getCart, user.id);
  yield call(Air.setWarm, 'cart.items', JSON.stringify(cart.items));
  yield call(Air.setWarm, 'cart.count', cart.items.length);
}

// sagas/analytics.ts - Handles all analytics events
export function* analyticsWatcher() {
  yield takeEvery('analytics/TRACK', trackEventWorker);
}

function* trackEventWorker(action) {
  const { event, ...data } = action.payload;
  yield call(analyticsService.track, event, data);
}
```

**How it flows:**

```
User clicks Login
       │
       ▼
dispatch({ type: 'auth/LOGIN' })
       │
       ▼
┌─────────────────────────────────────────────────────┐
│ loginWorker                                          │
│   1. Call API                                        │
│   2. Store user                                      │
│   3. put({ type: 'auth/LOGIN_SUCCESS' })  ──────────┼──► Other sagas can react
│   4. put({ type: 'user/FETCH_PROFILE' })  ──────────┼──► userWatcher picks this up
│   5. put({ type: 'cart/LOAD' })           ──────────┼──► cartWatcher picks this up
│   6. put({ type: 'analytics/TRACK' })     ──────────┼──► analyticsWatcher picks this up
└─────────────────────────────────────────────────────┘
```

This pattern keeps sagas decoupled - the auth saga doesn't need to know *how* to load the cart or fetch the profile, it just dispatches an action and the appropriate saga handles it.

### Advanced: Waiting for Actions

Workers can wait for other actions:

```typescript
function* checkoutWorker() {
  // Start checkout
  yield call(paymentApi.initiate);

  // Wait for either success or failure from payment processor
  const result = yield race({
    success: take('payment/SUCCESS'),
    failure: take('payment/FAILURE'),
    timeout: delay(30000),
  });

  if (result.success) {
    yield put({ type: 'cart/CHECKOUT_SUCCESS' });
  } else if (result.failure) {
    yield put({ type: 'cart/CHECKOUT_FAILURE', payload: result.failure.payload });
  } else {
    yield put({ type: 'cart/CHECKOUT_FAILURE', payload: 'Payment timed out' });
  }
}
```

---

## Patterns

### Pattern 1: Simple Action Dispatch

```typescript
import { Missile } from 'react-native-s-a-m';

// Component just dispatches, saga handles everything
function AddToCartButton({ productId }) {
  return (
    <Button
      onPress={() => Missile.dispatch({
        type: 'cart/ADD_ITEM',
        payload: { productId, quantity: 1 }
      })}
      title="Add to Cart"
    />
  );
}
```

### Pattern 2: Watch State with useWarm

Components don't need to know about actions - they just watch storage:

```typescript
function CartBadge() {
  const [count, setCount] = useState(0);

  useWarm({ keys: ['cart.count'] }, (event) => {
    setCount(event.newValue || 0);
  });

  return <Badge count={count} />;
}
```

The saga updates `cart.count` in Warm storage, and all components watching it re-render automatically.

### Pattern 3: Loading States

Store loading state in Warm storage:

```typescript
// saga
import { Missile, Air } from 'react-native-s-a-m';
const { call } = Missile;

function* handleFetchProducts() {
  yield call(Air.setWarm, 'products.loading', true);

  try {
    const products = yield call(api.fetchProducts);
    yield call(Air.setWarm, 'products.data', JSON.stringify(products));
  } finally {
    yield call(Air.setWarm, 'products.loading', false);
  }
}

// component
import { Missile, useWarm } from 'react-native-s-a-m';

function ProductList() {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);

  useWarm({ keys: ['products.loading', 'products.data'] }, (event) => {
    if (event.key === 'products.loading') setLoading(event.newValue);
    if (event.key === 'products.data') setProducts(JSON.parse(event.newValue || '[]'));
  });

  useEffect(() => {
    Missile.dispatch({ type: 'products/FETCH' });
  }, []);

  if (loading) return <Spinner />;
  return <FlatList data={products} ... />;
}
```

### Pattern 4: Error Handling

```typescript
// saga
import { Missile, Air } from 'react-native-s-a-m';
const { call } = Missile;

function* handleLogin(action) {
  yield call(Air.setWarm, 'auth.error', null);

  try {
    const user = yield call(authApi.login, action.payload);
    yield call(Air.setWarm, 'auth.user', JSON.stringify(user));
  } catch (error) {
    yield call(Air.setWarm, 'auth.error', error.message);
  }
}

// component
import { Missile, useWarm } from 'react-native-s-a-m';

function LoginForm() {
  const [error, setError] = useState(null);

  useWarm({ keys: ['auth.error'] }, (event) => {
    setError(event.newValue);
  });

  return (
    <>
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button onPress={() => Missile.dispatch({ type: 'auth/LOGIN', payload: formData })} />
    </>
  );
}
```

### Pattern 5: Typed Actions Helper

For better DX, create typed dispatch helpers:

```typescript
// actions/index.ts
import { Missile } from 'react-native-s-a-m';

export function dispatch<T extends keyof ActionPayloads>(
  type: T,
  payload?: ActionPayloads[T],
  status?: ActionStatus
) {
  Missile.dispatch({ type, payload, status });
}

type ActionPayloads = {
  'auth/LOGIN': { email: string; password: string };
  'auth/LOGOUT': void;
  'cart/ADD_ITEM': { productId: string; quantity: number };
  'products/FETCH': { category?: string };
};

type ActionStatus = 'pending' | 'success' | 'error';

// Usage
dispatch('auth/LOGIN', { email: 'a@b.com', password: 'secret' }); // ✓ typed
dispatch('auth/LOGIN', { email: 'a@b.com', password: 'secret' }, 'pending'); // ✓ with status
dispatch('auth/LOGIN', { wrong: 'field' }); // ✗ type error
```

---

## Full Example: Authentication Flow

```typescript
// actions/auth.ts
export const Auth = {
  LOGIN: 'auth/LOGIN',
  LOGIN_SUCCESS: 'auth/LOGIN_SUCCESS',
  LOGIN_FAILURE: 'auth/LOGIN_FAILURE',
  LOGOUT: 'auth/LOGOUT',
} as const;
```

```typescript
// sagas/auth.ts
import { takeLatest, call, put, race, delay, fork } from 'react-native-s-a-m';
import { Air, SecureStorage } from 'react-native-s-a-m';
import { Auth } from '../actions/auth';

function* handleLogin(action) {
  const { email, password } = action.payload;

  try {
    // Race between login and timeout
    const { response, timeout } = yield race({
      response: call(authApi.login, email, password),
      timeout: delay(10000),
    });

    if (timeout) throw new Error('Login timed out');

    // Store tokens
    yield call(SecureStorage.set, 'accessToken', response.accessToken);
    yield call(SecureStorage.set, 'refreshToken', response.refreshToken);

    // Update state
    yield call(Air.setWarm, 'auth.user', JSON.stringify(response.user));
    yield call(Air.setWarm, 'auth.isAuthenticated', true);
    yield call(Air.setWarm, 'auth.error', null);

    yield put({ type: Auth.LOGIN_SUCCESS, payload: response.user });

    // Start background token refresh
    yield fork(tokenRefreshLoop);

  } catch (error) {
    yield call(Air.setWarm, 'auth.error', error.message);
    yield put({ type: Auth.LOGIN_FAILURE, payload: error.message });
  }
}

function* handleLogout() {
  yield call(SecureStorage.delete, { service: 'auth' });
  yield call(Air.setWarm, 'auth.user', null);
  yield call(Air.setWarm, 'auth.isAuthenticated', false);
}

function* tokenRefreshLoop() {
  while (true) {
    yield delay(55 * 60 * 1000); // 55 minutes

    try {
      const refreshToken = yield call(SecureStorage.get, { service: 'auth' });
      const response = yield call(authApi.refresh, refreshToken);
      yield call(SecureStorage.set, 'accessToken', response.accessToken);
    } catch {
      yield put({ type: Auth.LOGOUT });
      break;
    }
  }
}

export function* authSaga() {
  yield takeLatest(Auth.LOGIN, handleLogin);
  yield takeLatest(Auth.LOGOUT, handleLogout);
}
```

```typescript
// screens/Login.tsx
import { useState } from 'react';
import { dispatch, useWarm } from 'react-native-s-a-m';
import { Auth } from '../actions/auth';

export function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Watch auth state
  useWarm({ keys: ['auth.error', 'auth.isAuthenticated'] }, (event) => {
    if (event.key === 'auth.error') setError(event.newValue);
    if (event.key === 'auth.isAuthenticated' && event.newValue) {
      navigation.navigate('Home');
    }
  });

  const handleLogin = () => {
    dispatch({ type: Auth.LOGIN, payload: { email, password } });
  };

  return (
    <View>
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" />
      <TextInput value={password} onChangeText={setPassword} secureTextEntry />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button onPress={handleLogin} title="Login" />
    </View>
  );
}
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Your App                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   Component                    Utility                   API      │
│   ─────────                    ───────                   ───      │
│   dispatch({ type, payload })  dispatch(...)      dispatch(...)   │
│          │                          │                    │        │
│          └──────────────────────────┴────────────────────┘        │
│                                 │                                 │
│                                 ▼                                 │
│                    ┌─────────────────────────┐                    │
│                    │    Action Channel       │                    │
│                    │   { type, payload }     │                    │
│                    └───────────┬─────────────┘                    │
│                                │                                  │
│              ┌─────────────────┼─────────────────┐                │
│              ▼                 ▼                 ▼                │
│       ┌──────────┐      ┌──────────┐      ┌──────────┐           │
│       │ authSaga │      │ cartSaga │      │ dataSaga │           │
│       └────┬─────┘      └────┬─────┘      └────┬─────┘           │
│            │                 │                 │                  │
│            └─────────────────┴─────────────────┘                  │
│                              │                                    │
│                              ▼                                    │
│         ┌─────────────────────────────────────────┐               │
│         │              Effects                     │               │
│         │  call() → APIs, Storage                  │               │
│         │  put()  → Dispatch more actions          │               │
│         └──────────────────┬──────────────────────┘               │
│                            │                                      │
│              ┌─────────────┼─────────────┐                        │
│              ▼             ▼             ▼                        │
│         ┌────────┐   ┌──────────┐   ┌────────────┐               │
│         │  Air   │   │ Secure   │   │ External   │               │
│         │ Warm/  │   │ Storage  │   │   APIs     │               │
│         │ Cold   │   │          │   │            │               │
│         └───┬────┘   └──────────┘   └────────────┘               │
│             │                                                     │
│             ▼                                                     │
│   ┌─────────────────────────────────────────────────────────┐    │
│   │                   React Components                       │    │
│   │                                                          │    │
│   │   useWarm({ keys: [...] }) ← Auto re-render on changes   │    │
│   │   useCold({ query: '...' }) ← Query results              │    │
│   │                                                          │    │
│   │   No business logic here - just render state!            │    │
│   └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## Comparison

| Aspect | Redux + Redux-Saga | Missile |
|--------|-------------------|---------|
| **Dispatch from component** | `useDispatch()` hook | `dispatch()` function |
| **Dispatch outside React** | Need store reference | `dispatch()` just works |
| **Setup** | Provider, store, middleware | `runSaga()` at startup |
| **Storage** | Separate (Redux Persist, etc) | Built-in (Air) |
| **Secure storage** | DIY | Built-in |
| **Bundle size** | Redux + React-Redux + Saga | Native C++ core |

---

## FAQ

**Q: How do I show loading states?**
A: Store loading state in Warm storage. Saga sets `loading: true` at start, `loading: false` when done. Component watches with `useWarm`.

**Q: How do I handle errors?**
A: Store error in Warm storage. Saga catches error and sets it. Component watches and displays.

**Q: Can I dispatch from outside React?**
A: Yes! `dispatch()` is a plain function. Use it in API interceptors, navigation handlers, utilities, anywhere.

**Q: What about TypeScript?**
A: Define your action types and payloads, then create a typed wrapper around `dispatch()` (see Pattern 5).

**Q: How is this different from just using events?**
A: Sagas give you powerful async flow control - race conditions, cancellation, debouncing, retries - all with simple generator syntax.

---

## Examples

For complete working examples, see the `docs/examples/` directory:

| File | Description |
|------|-------------|
| [01-basic-dispatch.ts](./examples/01-basic-dispatch.ts) | Basic action dispatch patterns, typed dispatch helper |
| [02-simple-saga.ts](./examples/02-simple-saga.ts) | Watcher/worker pattern with takeLatest/takeEvery |
| [03-auth-flow.ts](./examples/03-auth-flow.ts) | Complete authentication flow with token refresh |
| [04-dynamic-watchers.ts](./examples/04-dynamic-watchers.ts) | Screen-based, feature-based, and conditional watchers |
| [05-advanced-effects.ts](./examples/05-advanced-effects.ts) | race, all, channels, retry with backoff, optimistic updates |
| [06-storage-watchers.ts](./examples/06-storage-watchers.ts) | Watching Air storage changes instead of actions |

---

## Additional Resources

- **API Reference**: [MISSILE_API.md](./MISSILE_API.md) - Complete API documentation
- **Requirements**: [MISSILE_REQUIREMENTS.md](./MISSILE_REQUIREMENTS.md) - Feature specifications
