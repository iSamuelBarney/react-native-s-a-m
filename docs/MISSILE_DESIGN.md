# Missile - Action & Saga System Design Document

> **Status:** Design Draft - Not Yet Implemented

## Overview

Missile is a Flux-like action and saga system for S.A.M that provides:
- **Action Creators** - Type-safe action dispatching (`Missile.LOGIN()`)
- **Watchers** - Generator-based listeners that react to actions (like Redux-Saga)
- **Effects** - Utilities for async flow control (call, put, select, fork, etc.)
- **Separation of Concerns** - Business logic lives in sagas, not components

## Philosophy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            S.A.M Architecture                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                  │
│   │    Air      │     │   Missile   │     │   Storage   │                  │
│   │  (Storage)  │◄───►│  (Actions)  │◄───►│  (Warm/Cold)│                  │
│   └─────────────┘     └─────────────┘     └─────────────┘                  │
│         │                   │                   │                          │
│         │                   │                   │                          │
│         ▼                   ▼                   ▼                          │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │                     React Components                             │      │
│   │                                                                  │      │
│   │   • useWarm() - Watch storage changes                           │      │
│   │   • useMissile() - Dispatch actions & watch results             │      │
│   │   • No business logic in components!                            │      │
│   └─────────────────────────────────────────────────────────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Actions

Actions are plain objects with a `type` and optional `payload`:

```typescript
interface Action<T = any> {
  type: string;
  payload?: T;
}

// Action types are defined as constants
const ActionTypes = {
  LOGIN: 'auth/LOGIN',
  LOGIN_SUCCESS: 'auth/LOGIN_SUCCESS',
  LOGIN_FAILURE: 'auth/LOGIN_FAILURE',
  LOGOUT: 'auth/LOGOUT',
  FETCH_USER: 'user/FETCH_USER',
  UPDATE_CART: 'cart/UPDATE_CART',
} as const;
```

### 2. Action Creators

Missile provides a fluent API for creating and dispatching actions:

```typescript
// Define action creators on your Missile subclass
class AppMissile extends Missile {
  // Simple action with no payload
  static LOGOUT = Missile.createAction('auth/LOGOUT');

  // Action with typed payload
  static LOGIN = Missile.createAction<{ email: string; password: string }>('auth/LOGIN');

  // Action with payload transformer
  static ADD_TO_CART = Missile.createAction(
    'cart/ADD_TO_CART',
    (productId: string, quantity: number) => ({ productId, quantity })
  );
}

// Usage in components
AppMissile.LOGIN({ email: 'user@example.com', password: 'secret' });
AppMissile.LOGOUT();
AppMissile.ADD_TO_CART('product-123', 2);
```

### 3. Watchers (Sagas)

Watchers are generator functions that listen for specific actions:

```typescript
import { Missile, takeEvery, takeLatest, call, put, select } from 'react-native-s-a-m';

// Define a watcher saga
function* watchLogin() {
  yield takeEvery('auth/LOGIN', handleLogin);
}

// Handler saga
function* handleLogin(action: Action<{ email: string; password: string }>) {
  try {
    // Call async function
    const user = yield call(authService.login, action.payload);

    // Store user in Warm storage
    yield call(Air.setWarm, 'user.data', JSON.stringify(user));
    yield call(Air.setWarm, 'user.isLoggedIn', true);

    // Dispatch success action
    yield put({ type: 'auth/LOGIN_SUCCESS', payload: user });

  } catch (error) {
    // Dispatch failure action
    yield put({ type: 'auth/LOGIN_FAILURE', payload: error.message });
  }
}

// Register watchers
Missile.run(watchLogin);
```

### 4. Effects

Effects are instructions to the saga middleware:

| Effect | Description | Example |
|--------|-------------|---------|
| `call` | Call a function (blocking) | `yield call(api.fetch, '/users')` |
| `put` | Dispatch an action | `yield put({ type: 'SUCCESS' })` |
| `select` | Read from storage | `yield select(state => state.user)` |
| `take` | Wait for specific action | `yield take('LOGIN_SUCCESS')` |
| `takeEvery` | Run saga on every action | `yield takeEvery('FETCH', handler)` |
| `takeLatest` | Cancel previous, run latest | `yield takeLatest('SEARCH', handler)` |
| `fork` | Non-blocking call | `yield fork(backgroundSync)` |
| `cancel` | Cancel a forked task | `yield cancel(task)` |
| `race` | First to complete wins | `yield race({ response, timeout })` |
| `all` | Wait for all to complete | `yield all([task1, task2])` |
| `delay` | Wait for duration | `yield delay(1000)` |

---

## Usage Examples

### Example 1: Authentication Flow

```typescript
// missile/auth.ts
import { Missile, takeLatest, call, put, take, race, delay } from 'react-native-s-a-m';

// Action Creators
export class AuthMissile extends Missile {
  static LOGIN = Missile.createAction<{ email: string; password: string }>('auth/LOGIN');
  static LOGIN_SUCCESS = Missile.createAction<{ user: User }>('auth/LOGIN_SUCCESS');
  static LOGIN_FAILURE = Missile.createAction<{ error: string }>('auth/LOGIN_FAILURE');
  static LOGOUT = Missile.createAction('auth/LOGOUT');
  static REFRESH_TOKEN = Missile.createAction('auth/REFRESH_TOKEN');
}

// Sagas
function* handleLogin(action: ReturnType<typeof AuthMissile.LOGIN>) {
  const { email, password } = action.payload;

  try {
    // Race between login and timeout
    const { response, timeout } = yield race({
      response: call(authApi.login, email, password),
      timeout: delay(10000),
    });

    if (timeout) {
      throw new Error('Login timed out');
    }

    // Store tokens securely
    yield call(SecureStorage.set, 'accessToken', response.accessToken);
    yield call(SecureStorage.set, 'refreshToken', response.refreshToken);

    // Store user in Warm storage
    yield call(Air.setWarm, 'user.profile', JSON.stringify(response.user));
    yield call(Air.setWarm, 'user.isAuthenticated', true);

    // Dispatch success
    yield put(AuthMissile.LOGIN_SUCCESS({ user: response.user }));

    // Start token refresh cycle
    yield fork(tokenRefreshCycle);

  } catch (error) {
    yield put(AuthMissile.LOGIN_FAILURE({ error: error.message }));
  }
}

function* handleLogout() {
  // Clear secure storage
  yield call(SecureStorage.delete, { service: 'auth' });

  // Clear warm storage
  yield call(Air.deleteWarm, 'user.profile');
  yield call(Air.setWarm, 'user.isAuthenticated', false);
}

function* tokenRefreshCycle() {
  while (true) {
    // Wait 55 minutes before refresh (tokens expire in 60 min)
    yield delay(55 * 60 * 1000);

    try {
      const refreshToken = yield call(SecureStorage.get, { service: 'auth' });
      const response = yield call(authApi.refresh, refreshToken.password);
      yield call(SecureStorage.set, 'accessToken', response.accessToken);
    } catch (error) {
      // Token refresh failed, logout
      yield put(AuthMissile.LOGOUT());
      break;
    }
  }
}

// Root auth saga
export function* authSaga() {
  yield takeLatest(AuthMissile.LOGIN.type, handleLogin);
  yield takeLatest(AuthMissile.LOGOUT.type, handleLogout);
}
```

### Example 2: Data Fetching with Caching

```typescript
// missile/products.ts
import { Missile, takeLatest, call, put, select, race, delay } from 'react-native-s-a-m';

export class ProductMissile extends Missile {
  static FETCH_PRODUCTS = Missile.createAction<{ category?: string }>('products/FETCH');
  static FETCH_SUCCESS = Missile.createAction<{ products: Product[] }>('products/FETCH_SUCCESS');
  static FETCH_FAILURE = Missile.createAction<{ error: string }>('products/FETCH_FAILURE');
  static INVALIDATE_CACHE = Missile.createAction('products/INVALIDATE_CACHE');
}

function* fetchProducts(action: ReturnType<typeof ProductMissile.FETCH_PRODUCTS>) {
  const { category } = action.payload;
  const cacheKey = `products.${category || 'all'}`;

  // Check cache first
  const cachedData = yield call(Air.getWarm, cacheKey);
  const cacheTimestamp = yield call(Air.getWarm, `${cacheKey}.timestamp`);

  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const isCacheValid = cachedData &&
    cacheTimestamp &&
    (Date.now() - cacheTimestamp) < CACHE_TTL;

  if (isCacheValid) {
    // Return cached data immediately
    yield put(ProductMissile.FETCH_SUCCESS({
      products: JSON.parse(cachedData)
    }));
    return;
  }

  try {
    const products = yield call(api.fetchProducts, category);

    // Cache in Warm storage
    yield call(Air.setWarm, cacheKey, JSON.stringify(products));
    yield call(Air.setWarm, `${cacheKey}.timestamp`, Date.now());

    // Also persist to Cold storage for offline access
    yield call(persistProductsToCold, products);

    yield put(ProductMissile.FETCH_SUCCESS({ products }));

  } catch (error) {
    // Try to load from Cold storage as fallback
    const offlineProducts = yield call(loadProductsFromCold, category);

    if (offlineProducts.length > 0) {
      yield put(ProductMissile.FETCH_SUCCESS({ products: offlineProducts }));
    } else {
      yield put(ProductMissile.FETCH_FAILURE({ error: error.message }));
    }
  }
}

function* persistProductsToCold(products: Product[]) {
  for (const product of products) {
    yield call(
      Air.executeCold,
      `INSERT OR REPLACE INTO products (id, name, price, category, data)
       VALUES (?, ?, ?, ?, ?)`,
      [product.id, product.name, product.price, product.category, JSON.stringify(product)]
    );
  }
}

function* loadProductsFromCold(category?: string) {
  const sql = category
    ? 'SELECT data FROM products WHERE category = ?'
    : 'SELECT data FROM products';
  const params = category ? [category] : [];

  const rows = yield call(Air.queryCold, sql, params);
  return rows.map(row => JSON.parse(row.data));
}

export function* productsSaga() {
  yield takeLatest(ProductMissile.FETCH_PRODUCTS.type, fetchProducts);
}
```

### Example 3: Shopping Cart with Real-time Sync

```typescript
// missile/cart.ts
import { Missile, takeEvery, takeLatest, call, put, select, debounce, fork } from 'react-native-s-a-m';

export class CartMissile extends Missile {
  static ADD_ITEM = Missile.createAction<{ productId: string; quantity: number }>('cart/ADD_ITEM');
  static REMOVE_ITEM = Missile.createAction<{ productId: string }>('cart/REMOVE_ITEM');
  static UPDATE_QUANTITY = Missile.createAction<{ productId: string; quantity: number }>('cart/UPDATE_QUANTITY');
  static SYNC_CART = Missile.createAction('cart/SYNC');
  static SYNC_SUCCESS = Missile.createAction('cart/SYNC_SUCCESS');
  static CHECKOUT = Missile.createAction('cart/CHECKOUT');
}

function* addItem(action: ReturnType<typeof CartMissile.ADD_ITEM>) {
  const { productId, quantity } = action.payload;

  // Get current cart from Warm storage
  const cartJson = yield call(Air.getWarm, 'cart.items');
  const cart = cartJson ? JSON.parse(cartJson) : [];

  // Update cart
  const existingIndex = cart.findIndex(item => item.productId === productId);
  if (existingIndex >= 0) {
    cart[existingIndex].quantity += quantity;
  } else {
    cart.push({ productId, quantity });
  }

  // Save to Warm storage
  yield call(Air.setWarm, 'cart.items', JSON.stringify(cart));
  yield call(Air.setWarm, 'cart.count', cart.reduce((sum, item) => sum + item.quantity, 0));

  // Trigger sync (debounced)
  yield put(CartMissile.SYNC_CART());
}

function* syncCart() {
  const cartJson = yield call(Air.getWarm, 'cart.items');
  const cart = cartJson ? JSON.parse(cartJson) : [];

  try {
    // Sync with server
    yield call(cartApi.sync, cart);
    yield put(CartMissile.SYNC_SUCCESS());
  } catch (error) {
    // Queue for retry - cart is already in Warm storage
    console.warn('Cart sync failed, will retry');
  }
}

function* handleCheckout() {
  const cartJson = yield call(Air.getWarm, 'cart.items');
  const cart = cartJson ? JSON.parse(cartJson) : [];

  if (cart.length === 0) {
    return;
  }

  try {
    // Create order
    const order = yield call(orderApi.create, cart);

    // Persist order to Cold storage
    yield call(
      Air.executeCold,
      'INSERT INTO orders (id, status, items, total, created_at) VALUES (?, ?, ?, ?, ?)',
      [order.id, 'pending', JSON.stringify(cart), order.total, Date.now()]
    );

    // Clear cart
    yield call(Air.deleteWarm, 'cart.items');
    yield call(Air.setWarm, 'cart.count', 0);

    yield put({ type: 'cart/CHECKOUT_SUCCESS', payload: order });

  } catch (error) {
    yield put({ type: 'cart/CHECKOUT_FAILURE', payload: error.message });
  }
}

export function* cartSaga() {
  yield takeEvery(CartMissile.ADD_ITEM.type, addItem);
  yield takeEvery(CartMissile.REMOVE_ITEM.type, removeItem);
  yield takeEvery(CartMissile.UPDATE_QUANTITY.type, updateQuantity);
  yield debounce(1000, CartMissile.SYNC_CART.type, syncCart); // Debounce sync by 1 second
  yield takeLatest(CartMissile.CHECKOUT.type, handleCheckout);
}
```

### Example 4: React Component Usage

```typescript
// components/LoginScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text, ActivityIndicator } from 'react-native';
import { useMissile, useWarm } from 'react-native-s-a-m';
import { AuthMissile } from '../missile/auth';

function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Watch for auth actions
  const { isDispatching, lastAction, error } = useMissile({
    watch: [
      AuthMissile.LOGIN.type,
      AuthMissile.LOGIN_SUCCESS.type,
      AuthMissile.LOGIN_FAILURE.type,
    ],
    onAction: (action) => {
      if (action.type === AuthMissile.LOGIN_SUCCESS.type) {
        navigation.navigate('Home');
      }
    },
  });

  // Watch auth state in Warm storage
  const { } = useWarm({
    keys: ['user.isAuthenticated'],
  }, (event) => {
    if (event.newValue === true) {
      navigation.navigate('Home');
    }
  });

  const handleLogin = () => {
    // Dispatch action - saga handles the rest
    AuthMissile.LOGIN({ email, password });
  };

  const isLoading = isDispatching && lastAction?.type === AuthMissile.LOGIN.type;

  return (
    <View>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        editable={!isLoading}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!isLoading}
      />

      {error && <Text style={{ color: 'red' }}>{error}</Text>}

      <Button
        title={isLoading ? 'Logging in...' : 'Login'}
        onPress={handleLogin}
        disabled={isLoading}
      />

      {isLoading && <ActivityIndicator />}
    </View>
  );
}
```

### Example 5: Custom Missile Subclass

```typescript
// missile/AppMissile.ts
import { Missile } from 'react-native-s-a-m';
import { authSaga, AuthMissile } from './auth';
import { productsSaga, ProductMissile } from './products';
import { cartSaga, CartMissile } from './cart';

// Combine all action creators into one class
export class AppMissile extends Missile {
  // Auth actions
  static LOGIN = AuthMissile.LOGIN;
  static LOGIN_SUCCESS = AuthMissile.LOGIN_SUCCESS;
  static LOGIN_FAILURE = AuthMissile.LOGIN_FAILURE;
  static LOGOUT = AuthMissile.LOGOUT;

  // Product actions
  static FETCH_PRODUCTS = ProductMissile.FETCH_PRODUCTS;

  // Cart actions
  static ADD_TO_CART = CartMissile.ADD_ITEM;
  static CHECKOUT = CartMissile.CHECKOUT;

  // Initialize all sagas
  static initialize() {
    Missile.run(authSaga);
    Missile.run(productsSaga);
    Missile.run(cartSaga);
  }
}

// App.tsx
import { AppMissile } from './missile/AppMissile';

// Initialize sagas at app start
AppMissile.initialize();

// Now use anywhere in your app:
// AppMissile.LOGIN({ email, password });
// AppMissile.FETCH_PRODUCTS({ category: 'electronics' });
// AppMissile.ADD_TO_CART({ productId: '123', quantity: 1 });
```

---

## API Reference (Proposed)

### Missile Class

```typescript
class Missile {
  // Create a typed action creator
  static createAction<P = void>(type: string): ActionCreator<P>;
  static createAction<P, A extends any[]>(
    type: string,
    prepareAction: (...args: A) => P
  ): PreparedActionCreator<P, A>;

  // Run a saga
  static run(saga: GeneratorFunction): Task;

  // Cancel a running saga
  static cancel(task: Task): void;

  // Dispatch an action directly
  static dispatch(action: Action): void;

  // Get current running sagas
  static getRunningTasks(): Task[];

  // Subscribe to all actions (for debugging)
  static subscribe(listener: (action: Action) => void): Unsubscribe;
}
```

### Effects

```typescript
// Call a function and wait for result
function call<T>(fn: (...args: any[]) => T | Promise<T>, ...args: any[]): CallEffect<T>;

// Dispatch an action
function put(action: Action): PutEffect;

// Read from storage (Warm or Cold)
function select<T>(selector: (storage: StorageState) => T): SelectEffect<T>;

// Wait for a specific action
function take(pattern: string | string[]): TakeEffect;

// Run handler on every matching action
function takeEvery(pattern: string, handler: GeneratorFunction): ForkEffect;

// Run handler on latest matching action (cancels previous)
function takeLatest(pattern: string, handler: GeneratorFunction): ForkEffect;

// Run handler after debounce period
function debounce(ms: number, pattern: string, handler: GeneratorFunction): ForkEffect;

// Run handler at most once per period
function throttle(ms: number, pattern: string, handler: GeneratorFunction): ForkEffect;

// Non-blocking call
function fork(saga: GeneratorFunction, ...args: any[]): ForkEffect;

// Spawn detached saga
function spawn(saga: GeneratorFunction, ...args: any[]): SpawnEffect;

// Cancel a forked task
function cancel(task: Task): CancelEffect;

// Race between effects (first wins)
function race<T extends Record<string, Effect>>(effects: T): RaceEffect<T>;

// Wait for all effects to complete
function all<T extends Effect[]>(effects: T): AllEffect<T>;

// Delay execution
function delay(ms: number): DelayEffect;
```

### useMissile Hook

```typescript
interface UseMissileConfig {
  // Action types to watch
  watch?: string[];

  // Callback when watched action occurs
  onAction?: (action: Action) => void;

  // Auto-dispatch on mount
  dispatchOnMount?: Action;
}

interface UseMissileResult {
  // Whether any watched action is currently being processed
  isDispatching: boolean;

  // Last action that was dispatched
  lastAction: Action | null;

  // Error from last failed action
  error: string | null;

  // Dispatch an action
  dispatch: (action: Action) => void;
}

function useMissile(config: UseMissileConfig): UseMissileResult;
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Missile System                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │    Component    │                                                        │
│  │                 │                                                        │
│  │ Missile.LOGIN() ├──────────────────┐                                     │
│  │                 │                  │                                     │
│  └─────────────────┘                  ▼                                     │
│                              ┌─────────────────┐                            │
│                              │  Action Channel │                            │
│                              │                 │                            │
│                              │ { type, payload}│                            │
│                              └────────┬────────┘                            │
│                                       │                                     │
│                    ┌──────────────────┼──────────────────┐                  │
│                    │                  │                  │                  │
│                    ▼                  ▼                  ▼                  │
│           ┌────────────────┐ ┌────────────────┐ ┌────────────────┐         │
│           │  Auth Saga     │ │ Products Saga  │ │  Cart Saga     │         │
│           │                │ │                │ │                │         │
│           │ takeLatest     │ │ takeLatest     │ │ takeEvery      │         │
│           │ LOGIN →        │ │ FETCH →        │ │ ADD_ITEM →     │         │
│           │ handleLogin()  │ │ fetchProducts()│ │ addItem()      │         │
│           └───────┬────────┘ └───────┬────────┘ └───────┬────────┘         │
│                   │                  │                  │                  │
│                   └──────────────────┼──────────────────┘                  │
│                                      │                                     │
│                                      ▼                                     │
│                           ┌─────────────────────┐                          │
│                           │       Effects       │                          │
│                           ├─────────────────────┤                          │
│                           │ call() → API/Storage│                          │
│                           │ put()  → Dispatch   │                          │
│                           │ select()→ Read      │                          │
│                           └──────────┬──────────┘                          │
│                                      │                                     │
│                    ┌─────────────────┼─────────────────┐                   │
│                    │                 │                 │                   │
│                    ▼                 ▼                 ▼                   │
│           ┌────────────────┐ ┌────────────────┐ ┌────────────────┐        │
│           │      Air       │ │ SecureStorage  │ │   External     │        │
│           │  Warm / Cold   │ │   Keychain     │ │     APIs       │        │
│           └────────────────┘ └────────────────┘ └────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Why Missile?

### Compared to Redux-Saga in React Native

| Aspect | Redux-Saga | Missile |
|--------|------------|---------|
| **Setup** | Redux store + saga middleware + provider | Single `Missile.run()` call |
| **Storage** | Separate persistence layer | Built-in Air (Warm/Cold) |
| **Secure Storage** | DIY | Built-in SecureStorage |
| **Bundle Size** | Redux + React-Redux + Redux-Saga | Native C++ core |
| **Typing** | Verbose action types | Inferred from `createAction` |
| **React Native** | Afterthought | Native-first |

### Benefits

1. **Unified Storage + Actions** - No separate state management layer
2. **Native Performance** - C++ core, not JS middleware
3. **Type Safety** - Full TypeScript inference
4. **Simple API** - `Missile.LOGIN()` instead of `dispatch(loginAction(payload))`
5. **Built-in Effects** - All saga effects, zero setup
6. **Extensible** - Subclass Missile for your app's actions

---

## Implementation Notes

### Generator Execution

The saga runner will need to:
1. Execute generator functions step by step
2. Handle yielded effects appropriately
3. Manage task lifecycle (fork, cancel)
4. Handle errors and propagate to error effects

### Action Channel

Actions will flow through a central channel:
1. Component dispatches action via `Missile.ACTION()`
2. Action enters channel
3. All registered watchers receive the action
4. Matching watchers execute their handlers

### Integration with Air

Effects like `select` should integrate with Air storage:
```typescript
// select reads from Warm/Cold storage
const userId = yield select((s) => s.warm['user.id']);
const orders = yield select((s) => s.cold.query('SELECT * FROM orders WHERE user_id = ?', [userId]));
```

---

## Open Questions

1. **Error Boundaries** - How should saga errors propagate to React?
2. **DevTools** - Should we build a Missile DevTools for action inspection?
3. **Persistence** - Should action history be persisted for replay?
4. **Testing** - How to make sagas easily testable?
5. **Hot Reloading** - How to handle saga hot reloading in development?

---

## Next Steps

1. Review and finalize API design
2. Implement core Missile class
3. Implement effect runners
4. Implement saga execution engine
5. Build React hooks integration
6. Add TypeScript type inference
7. Write documentation and examples
8. Create migration guide from Redux-Saga
