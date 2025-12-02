# Missile API Reference

> Complete API documentation for the Missile action dispatch and saga system.

## Table of Contents

- [Core Functions](#core-functions)
  - [dispatch](#missiledispatch)
  - [runSaga](#missilerunsaga)
  - [cancelSaga](#missilecancelsaga)
- [Named Saga Registry](#named-saga-registry)
  - [register](#missileregister)
  - [unregister](#missileunregister)
  - [isRegistered](#missileisregistered)
  - [getRegistered](#missilegetregistered)
  - [getRegisteredNames](#missilegetregisterednames)
  - [unregisterAll](#missileunregisterall)
- [Configuration](#configuration)
  - [configure](#missileconfigure)
  - [subscribe](#missilesubscribe)
- [Debugging](#debugging)
  - [getRunningTasks](#missilegetrunningtasks)
  - [cancelAllTasks](#missilecancelalltasks)
- [Effects](#effects)
  - [call](#call)
  - [put](#put)
  - [take](#take)
  - [delay](#delay)
  - [fork](#fork)
  - [spawn](#spawn)
  - [cancel](#cancel)
  - [race](#race)
  - [all](#all)
  - [takeEvery](#takeevery)
  - [takeLatest](#takelatest)
  - [debounce](#debounce)
  - [throttle](#throttle)
  - [resolve](#resolve)
  - [reject](#reject)
- [Types](#types)
- [Channels](#channels)

---

## Core Functions

### Missile.dispatch

Dispatches an action to all registered saga watchers. Works anywhere - inside React components, utility functions, API interceptors, or any JavaScript code.

```typescript
function dispatch<T = any>(action: Action<T>): void
```

**Parameters:**
- `action` - An object with:
  - `type` (string, required) - Action type identifier
  - `payload` (any, optional) - Action data
  - `status` (string, optional) - Action status for lifecycle tracking

**Example:**
```typescript
import { Missile } from 'react-native-s-a-m';

// Basic dispatch
Missile.dispatch({ type: 'user/FETCH' });

// With payload
Missile.dispatch({
  type: 'auth/LOGIN',
  payload: { email: 'user@example.com', password: 'secret' }
});

// With status
Missile.dispatch({
  type: 'cart/CHECKOUT',
  payload: { cartId: '123' },
  status: 'pending'
});
```

**Throws:** Error if action is missing or has no `type` property.

---

### Missile.runSaga

Starts a saga (generator function) and returns a Task for managing it.

```typescript
function runSaga(saga: GeneratorFunction, ...args: any[]): Task
```

**Parameters:**
- `saga` - A generator function
- `...args` - Arguments passed to the saga

**Returns:** A `Task` object (see [Task Interface](#task-interface))

**Example:**
```typescript
import { Missile } from 'react-native-s-a-m';

function* mySaga(userId: string) {
  // saga logic
}

// Start the saga
const task = Missile.runSaga(mySaga, 'user-123');

// Later, check status or cancel
if (task.isRunning()) {
  task.cancel();
}
```

---

### Missile.cancelSaga

Cancels a running saga by its task reference.

```typescript
function cancelSaga(task: Task): void
```

**Parameters:**
- `task` - The Task returned by `runSaga`

**Example:**
```typescript
const task = Missile.runSaga(myWatcher);

// Later...
Missile.cancelSaga(task);
```

---

## Named Saga Registry

The named registry allows you to manage sagas by name, making it easy to start/stop them dynamically.

### Missile.register

Registers and starts a named saga. If a saga with the same name exists, it's stopped first.

```typescript
function register(name: string, saga: GeneratorFunction, ...args: any[]): Task
```

**Parameters:**
- `name` - Unique identifier for this saga
- `saga` - Generator function to run
- `...args` - Arguments passed to the saga

**Returns:** A `Task` object

**Example:**
```typescript
import { Missile } from 'react-native-s-a-m';
import { cartWatcher } from './sagas/cart';

// Register when entering cart screen
Missile.register('cart-watcher', cartWatcher);

// Re-registering with same name automatically stops the previous one
Missile.register('cart-watcher', newCartWatcher);
```

---

### Missile.unregister

Stops and removes a named saga.

```typescript
function unregister(name: string): boolean
```

**Parameters:**
- `name` - The saga name to unregister

**Returns:** `true` if saga was found and stopped, `false` if not found

**Example:**
```typescript
// Stop the cart watcher
const wasRunning = Missile.unregister('cart-watcher');
```

---

### Missile.isRegistered

Checks if a named saga is currently registered and running.

```typescript
function isRegistered(name: string): boolean
```

**Example:**
```typescript
if (!Missile.isRegistered('auth-watcher')) {
  Missile.register('auth-watcher', authWatcher);
}
```

---

### Missile.getRegistered

Gets the Task for a named saga.

```typescript
function getRegistered(name: string): Task | undefined
```

**Example:**
```typescript
const task = Missile.getRegistered('cart-watcher');
if (task?.isRunning()) {
  console.log('Cart watcher is active');
}
```

---

### Missile.getRegisteredNames

Returns all registered saga names.

```typescript
function getRegisteredNames(): string[]
```

**Example:**
```typescript
const names = Missile.getRegisteredNames();
// ['auth-watcher', 'cart-watcher', 'sync-watcher']
```

---

### Missile.unregisterAll

Stops all named sagas. Useful for cleanup on logout.

```typescript
function unregisterAll(): void
```

**Example:**
```typescript
// On logout, stop everything
function* logoutWorker() {
  yield call(clearUserData);
  Missile.unregisterAll();
}
```

---

## Configuration

### Missile.configure

Sets global configuration options.

```typescript
function configure(options: SagaMiddlewareConfig): void

interface SagaMiddlewareConfig {
  debug?: boolean;
  onError?: (error: Error, context: { sagaId: string; action?: Action }) => void;
  maxConcurrentTasks?: number;
}
```

**Example:**
```typescript
Missile.configure({
  debug: __DEV__,
  onError: (error, { sagaId }) => {
    console.error(`Saga ${sagaId} failed:`, error);
    crashReporter.log(error);
  },
});
```

---

### Missile.subscribe

Subscribes to all dispatched actions. Useful for logging/debugging.

```typescript
function subscribe(subscriber: (action: Action) => void): () => void
```

**Returns:** Unsubscribe function

**Example:**
```typescript
// Log all actions
const unsubscribe = Missile.subscribe((action) => {
  console.log(`[Action] ${action.type}`, action.payload);
});

// Later, stop logging
unsubscribe();
```

---

## Debugging

### Missile.getRunningTasks

Returns all currently running tasks.

```typescript
function getRunningTasks(): Task[]
```

**Example:**
```typescript
const tasks = Missile.getRunningTasks();
console.log(`${tasks.length} sagas running`);
tasks.forEach(t => console.log(t.id));
```

---

### Missile.cancelAllTasks

Cancels all running tasks (root tasks and their children).

```typescript
function cancelAllTasks(): void
```

**Example:**
```typescript
// Emergency stop all sagas
Missile.cancelAllTasks();
```

---

## Effects

Effects are yielded inside sagas to perform operations. Import them from the Missile namespace:

```typescript
import { Missile } from 'react-native-s-a-m';
const { call, put, take, delay, fork, cancel, race, all, takeEvery, takeLatest, debounce, throttle } = Missile;
```

### call

Calls a function (sync or async) and returns its result.

```typescript
function call<T>(fn: (...args: any[]) => T | Promise<T>, ...args: any[]): CallEffect<T>
function call<T>(fnWithContext: [context, fn], ...args: any[]): CallEffect<T>
```

**Example:**
```typescript
function* fetchUserSaga(userId: string) {
  // Call an async function
  const user = yield call(api.getUser, userId);

  // Call with context (this binding)
  const result = yield call([myService, myService.fetch], params);

  // Call a sync function
  const parsed = yield call(JSON.parse, jsonString);
}
```

---

### put

Dispatches an action (same as `Missile.dispatch` but as an effect).

```typescript
function put<T>(action: Action<T>): PutEffect
```

**Example:**
```typescript
function* loginSaga(action) {
  try {
    const user = yield call(api.login, action.payload);
    yield put({ type: 'auth/LOGIN_SUCCESS', payload: user });
  } catch (error) {
    yield put({ type: 'auth/LOGIN_FAILURE', payload: error.message });
  }
}
```

---

### take

Blocks until an action matching the pattern is dispatched.

```typescript
function take(pattern: string | string[] | ((action: Action) => boolean)): TakeEffect
function take<T>(channel: Channel<T>): TakeEffect
```

**Pattern types:**
- `'ACTION_TYPE'` - Exact match
- `'namespace/*'` - Prefix match (matches `namespace/FOO`, `namespace/BAR`, etc.)
- `'*'` - Matches all actions
- `['TYPE_A', 'TYPE_B']` - Matches any in array
- `(action) => boolean` - Custom matcher function

**Example:**
```typescript
function* loginFlowSaga() {
  while (true) {
    // Wait for login
    const loginAction = yield take('auth/LOGIN');

    // Do login...

    // Wait for either logout or session expiry
    const action = yield take(['auth/LOGOUT', 'auth/SESSION_EXPIRED']);

    // Clean up...
  }
}

// With custom matcher
const action = yield take(a => a.type.startsWith('user/') && a.payload?.important);
```

---

### delay

Pauses execution for a duration.

```typescript
function delay(ms: number): DelayEffect
```

**Example:**
```typescript
function* pollingSaga() {
  while (true) {
    yield call(fetchData);
    yield delay(30000); // Wait 30 seconds
  }
}
```

---

### fork

Starts a saga without blocking. The forked task is a child of the current task.

```typescript
function fork(saga: GeneratorFunction, ...args: any[]): ForkEffect
```

**Key behavior:**
- Parent continues immediately (non-blocking)
- If parent is cancelled, children are cancelled too
- Errors in forked tasks propagate to parent

**Example:**
```typescript
function* mainSaga() {
  // Start background tasks
  yield fork(syncSaga);
  yield fork(notificationSaga);

  // Continue with main logic...
  yield call(initializeApp);
}
```

---

### spawn

Like `fork`, but creates a detached task. Errors don't propagate to parent.

```typescript
function spawn(saga: GeneratorFunction, ...args: any[]): SpawnEffect
```

**Example:**
```typescript
function* mainSaga() {
  // Analytics can fail without crashing the app
  yield spawn(analyticsSaga);

  // This is critical
  yield call(loadUserData);
}
```

---

### cancel

Cancels a forked/spawned task.

```typescript
function cancel(task: Task): CancelEffect
function cancel(tasks: Task[]): CancelEffect
```

**Example:**
```typescript
function* watchWithTimeout() {
  const bgTask = yield fork(backgroundSync);

  yield delay(60000); // 1 minute

  yield cancel(bgTask); // Stop the background sync
}
```

---

### race

Runs multiple effects concurrently, resolves when the first one completes. Other effects are cancelled.

```typescript
function race<T extends Record<string, Effect>>(effects: T): RaceEffect<T>
```

**Returns:** Object with the winning key set, others undefined

**Example:**
```typescript
function* fetchWithTimeout() {
  const { response, timeout } = yield race({
    response: call(api.fetchData),
    timeout: delay(5000),
  });

  if (timeout) {
    throw new Error('Request timed out');
  }

  return response;
}

// Wait for user action or auto-proceed
const { userAction, auto } = yield race({
  userAction: take('user/CONFIRM'),
  auto: delay(10000),
});
```

---

### all

Runs multiple effects concurrently, waits for all to complete.

```typescript
function all<T extends Effect[]>(effects: T): AllEffect<T>
function all<T extends Record<string, Effect>>(effects: T): AllEffect<T>
```

**Example:**
```typescript
// Array form - returns array
const [users, products, categories] = yield all([
  call(api.getUsers),
  call(api.getProducts),
  call(api.getCategories),
]);

// Object form - returns object
const { user, settings } = yield all({
  user: call(api.getUser, userId),
  settings: call(api.getSettings),
});
```

---

### takeEvery

Spawns a saga for every action matching the pattern.

```typescript
function takeEvery(pattern: string | string[], saga: GeneratorFunction, ...args: any[]): TakeEveryEffect
```

**Behavior:** Does NOT cancel previous executions. All handlers run concurrently.

**Example:**
```typescript
function* watchAnalytics() {
  // Log every analytics event, never skip
  yield takeEvery('analytics/*', logEventSaga);
}

function* rootSaga() {
  yield takeEvery('FETCH_USER', fetchUserSaga);
  yield takeEvery(['ADD_ITEM', 'REMOVE_ITEM'], updateCartSaga);
}
```

---

### takeLatest

Spawns a saga for the latest action, cancelling any previous execution.

```typescript
function takeLatest(pattern: string | string[], saga: GeneratorFunction, ...args: any[]): TakeLatestEffect
```

**Behavior:** Cancels the previous handler if still running.

**Example:**
```typescript
function* watchSearch() {
  // Only process the latest search, cancel old ones
  yield takeLatest('search/QUERY', searchSaga);
}

function* watchFetch() {
  // If user refreshes rapidly, only the last refresh matters
  yield takeLatest('data/REFRESH', fetchDataSaga);
}
```

---

### debounce

Waits for a pause in actions before running the saga.

```typescript
function debounce(ms: number, pattern: string | string[], saga: GeneratorFunction, ...args: any[]): DebounceEffect
```

**Behavior:** Resets the timer each time a matching action arrives. Only runs after `ms` milliseconds of inactivity.

**Example:**
```typescript
function* watchSearchInput() {
  // Wait for user to stop typing for 300ms
  yield debounce(300, 'search/INPUT_CHANGED', performSearchSaga);
}

function* watchAutoSave() {
  // Auto-save 2 seconds after user stops editing
  yield debounce(2000, 'editor/CONTENT_CHANGED', autoSaveSaga);
}
```

---

### throttle

Runs the saga at most once per time period.

```typescript
function throttle(ms: number, pattern: string | string[], saga: GeneratorFunction, ...args: any[]): ThrottleEffect
```

**Behavior:** Ignores actions during the cooldown period.

**Example:**
```typescript
function* watchScroll() {
  // Handle scroll at most once per 100ms
  yield throttle(100, 'ui/SCROLL', handleScrollSaga);
}

function* watchResize() {
  // Recalculate layout at most once per 200ms
  yield throttle(200, 'window/RESIZE', recalculateLayoutSaga);
}
```

---

### resolve

Creates an effect that immediately returns a value. Useful for early returns in sagas.

```typescript
function resolve<T>(value: T): CallEffect<T>
```

**Example:**
```typescript
function* fetchUserSaga(userId: string) {
  if (!userId) {
    return yield resolve(null); // Early return with null
  }

  const user = yield call(api.getUser, userId);
  return user;
}
```

---

### reject

Creates an effect that immediately throws an error.

```typescript
function reject(error: Error): CallEffect<never>
```

**Example:**
```typescript
function* protectedSaga() {
  const token = yield call(SecureStorage.get, 'accessToken');

  if (!token) {
    yield reject(new Error('Not authenticated'));
    return; // Never reached
  }

  // Proceed with authenticated request
  yield call(api.protectedEndpoint);
}
```

---

## Types

### Action Interface

```typescript
interface Action<T = any> {
  type: string;        // Required
  payload?: T;         // Optional
  status?: string;     // Optional ('pending', 'success', 'error', or custom)
}
```

### Task Interface

```typescript
interface Task<T = any> {
  id: string;                    // Unique task identifier
  isRunning(): boolean;          // Check if still running
  isCancelled(): boolean;        // Check if was cancelled
  isAborted(): boolean;          // Check if failed with error
  result(): T | undefined;       // Get result (if completed)
  error(): Error | null;         // Get error (if aborted)
  toPromise(): Promise<T>;       // Convert to promise
  cancel(): void;                // Cancel the task
}
```

### Channel Interface

```typescript
interface Channel<T = any> {
  take(): Promise<T>;            // Take next value (blocking)
  put(value: T): void;           // Put a value
  close(): void;                 // Close the channel
  isClosed(): boolean;           // Check if closed
  flush(): T[];                  // Get all buffered values
}
```

---

## Channels

Channels enable communication between sagas.

### Missile.channel

Creates a new channel.

```typescript
function channel<T>(config?: ChannelConfig): Channel<T>

interface ChannelConfig {
  buffer?: 'none' | 'fixed' | 'expanding' | 'dropping' | 'sliding';
  bufferSize?: number;
}
```

**Buffer types:**
- `'none'` - No buffer, drops if no taker
- `'fixed'` - Fixed size, blocks/drops on overflow
- `'expanding'` (default) - Grows as needed
- `'dropping'` - Drops new values when full
- `'sliding'` - Drops oldest values when full

**Example:**
```typescript
const { channel, call, take, put, fork } = Missile;

function* producer(ch) {
  for (let i = 0; i < 10; i++) {
    ch.put(i);
    yield delay(100);
  }
  ch.close();
}

function* consumer(ch) {
  while (!ch.isClosed()) {
    const value = yield take(ch);
    if (value !== undefined) {
      console.log('Received:', value);
    }
  }
}

function* main() {
  const ch = channel({ buffer: 'expanding', bufferSize: 5 });
  yield fork(producer, ch);
  yield fork(consumer, ch);
}
```
