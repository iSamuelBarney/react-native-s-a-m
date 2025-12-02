# Missile - Requirements Specification

> **Status:** Requirements Draft
> **Version:** 1.0.0

## Overview

Missile is a lightweight action dispatch and saga system for S.A.M that provides:
- A single `dispatch()` function that works anywhere (components, utilities, interceptors)
- Generator-based sagas (watchers & workers) for handling business logic
- Redux-Saga-compatible effects (`call`, `put`, `take`, `fork`, etc.)
- Integration with Air (Warm/Cold storage) for state management

## Functional Requirements

### FR-1: Action Dispatch

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1.1 | `dispatch()` must accept an action object with `type` (required), `payload` (optional), and `status` (optional) | P0 |
| FR-1.2 | `dispatch()` must work outside React components (no hooks/context required) | P0 |
| FR-1.3 | `dispatch()` must synchronously push actions to the action channel | P0 |
| FR-1.4 | Actions must be delivered to all registered saga watchers | P0 |
| FR-1.5 | `dispatch()` must be importable directly from `react-native-s-a-m` | P0 |

### FR-2: Saga Registration

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1 | `runSaga()` must accept a generator function and start execution | P0 |
| FR-2.2 | `runSaga()` must return a Task object for cancellation | P0 |
| FR-2.3 | Multiple sagas must be able to run concurrently | P0 |
| FR-2.4 | Sagas must be able to be registered at any point (not just app startup) | P1 |
| FR-2.5 | `cancelSaga()` must stop a running saga by task reference | P1 |

### FR-3: Effects - Core

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 | `call(fn, ...args)` must execute a function and return its result | P0 |
| FR-3.2 | `call()` must handle both sync and async functions | P0 |
| FR-3.3 | `put(action)` must dispatch an action to the action channel | P0 |
| FR-3.4 | `take(pattern)` must block until matching action is dispatched | P0 |
| FR-3.5 | `take()` must support string patterns and arrays of strings | P0 |
| FR-3.6 | `delay(ms)` must pause execution for specified milliseconds | P0 |

### FR-4: Effects - Watchers

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4.1 | `takeEvery(pattern, saga)` must run saga for every matching action | P0 |
| FR-4.2 | `takeLatest(pattern, saga)` must cancel previous and run only latest | P0 |
| FR-4.3 | `debounce(ms, pattern, saga)` must wait for pause before running | P1 |
| FR-4.4 | `throttle(ms, pattern, saga)` must limit execution frequency | P1 |

### FR-5: Effects - Concurrency

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-5.1 | `fork(saga, ...args)` must start saga without blocking | P0 |
| FR-5.2 | `fork()` must return a Task for later cancellation | P0 |
| FR-5.3 | `cancel(task)` must stop a forked task | P0 |
| FR-5.4 | `race({ key: effect })` must resolve when first effect completes | P1 |
| FR-5.5 | `race()` must cancel losing effects | P1 |
| FR-5.6 | `all([effects])` must wait for all effects to complete | P1 |
| FR-5.7 | `spawn(saga)` must create a detached saga (errors don't propagate) | P2 |

### FR-6: Storage Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-6.1 | `Air.watchWarm(key)` must return a channel for storage changes | P1 |
| FR-6.2 | Channels must emit events with `oldValue`, `newValue`, `key` | P1 |
| FR-6.3 | `take(channel)` must work with storage watch channels | P1 |
| FR-6.4 | Sagas must be able to read/write Air storage via `call()` | P0 |

### FR-7: Error Handling

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-7.1 | Errors in workers must not crash the entire saga system | P0 |
| FR-7.2 | Errors must be catchable with try/catch in generators | P0 |
| FR-7.3 | Uncaught errors must be logged with stack traces | P0 |
| FR-7.4 | `onError` callback must be configurable globally | P1 |

## Non-Functional Requirements

### NFR-1: Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1.1 | Action dispatch latency | < 1ms |
| NFR-1.2 | Memory overhead per saga | < 10KB |
| NFR-1.3 | Maximum concurrent sagas | 100+ |
| NFR-1.4 | Effect resolution overhead | < 0.5ms |

### NFR-2: Developer Experience

| ID | Requirement |
|----|-------------|
| NFR-2.1 | Full TypeScript support with type inference |
| NFR-2.2 | No required boilerplate (providers, stores, etc.) |
| NFR-2.3 | Clear error messages with suggestions |
| NFR-2.4 | Compatible with React Native Fast Refresh |

### NFR-3: Compatibility

| ID | Requirement |
|----|-------------|
| NFR-3.1 | Works with React Native 0.70+ |
| NFR-3.2 | Works with New Architecture (Fabric/TurboModules) |
| NFR-3.3 | Works with Expo (managed and bare) |
| NFR-3.4 | No native code required for Missile itself |

## Action Interface

```typescript
interface Action<T = any> {
  /** Action type identifier (required) */
  type: string;

  /** Action payload data (optional) */
  payload?: T;

  /** Action status for lifecycle tracking (optional) */
  status?: 'pending' | 'success' | 'error' | string;
}
```

## Effect Signatures

```typescript
// Core effects
function call<T>(fn: (...args: any[]) => T | Promise<T>, ...args: any[]): CallEffect<T>;
function put(action: Action): PutEffect;
function take(pattern: string | string[]): TakeEffect;
function delay(ms: number): DelayEffect;

// Watcher effects
function takeEvery(pattern: string, saga: GeneratorFunction): ForkEffect;
function takeLatest(pattern: string, saga: GeneratorFunction): ForkEffect;
function debounce(ms: number, pattern: string, saga: GeneratorFunction): ForkEffect;
function throttle(ms: number, pattern: string, saga: GeneratorFunction): ForkEffect;

// Concurrency effects
function fork(saga: GeneratorFunction, ...args: any[]): ForkEffect;
function spawn(saga: GeneratorFunction, ...args: any[]): SpawnEffect;
function cancel(task: Task): CancelEffect;
function race<T extends Record<string, Effect>>(effects: T): RaceEffect<T>;
function all<T extends Effect[]>(effects: T): AllEffect<T>;
```

## Task Interface

```typescript
interface Task {
  /** Unique task identifier */
  id: string;

  /** Whether the task is still running */
  isRunning(): boolean;

  /** Whether the task was cancelled */
  isCancelled(): boolean;

  /** Whether the task completed with error */
  isAborted(): boolean;

  /** Get the task result (if completed) */
  result(): any;

  /** Get the task error (if aborted) */
  error(): Error | null;

  /** Promise that resolves when task completes */
  toPromise(): Promise<any>;

  /** Cancel the task */
  cancel(): void;
}
```

## Channel Interface

```typescript
interface Channel<T> {
  /** Take the next value from the channel */
  take(): Promise<T>;

  /** Put a value into the channel */
  put(value: T): void;

  /** Close the channel */
  close(): void;

  /** Whether the channel is closed */
  isClosed(): boolean;
}

interface StorageChangeEvent {
  key: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}
```

## Public API

```typescript
// Main exports from react-native-s-a-m
export { dispatch } from './missile';
export { runSaga, cancelSaga } from './missile';
export {
  call,
  put,
  take,
  delay,
  takeEvery,
  takeLatest,
  debounce,
  throttle,
  fork,
  spawn,
  cancel,
  race,
  all,
} from './missile/effects';
export type { Action, Task, Channel, Effect } from './missile/types';
```

## Test Cases

### TC-1: Basic Dispatch

```typescript
test('dispatch sends action to watchers', async () => {
  const received: Action[] = [];

  function* testWatcher() {
    while (true) {
      const action = yield take('TEST');
      received.push(action);
    }
  }

  runSaga(testWatcher);
  dispatch({ type: 'TEST', payload: { value: 1 } });

  await delay(10);
  expect(received).toHaveLength(1);
  expect(received[0].payload.value).toBe(1);
});
```

### TC-2: takeLatest Cancellation

```typescript
test('takeLatest cancels previous execution', async () => {
  let completedCount = 0;

  function* slowWorker() {
    yield delay(100);
    completedCount++;
  }

  function* watcher() {
    yield takeLatest('FETCH', slowWorker);
  }

  runSaga(watcher);

  // Dispatch 3 times rapidly
  dispatch({ type: 'FETCH' });
  dispatch({ type: 'FETCH' });
  dispatch({ type: 'FETCH' });

  await delay(200);
  expect(completedCount).toBe(1); // Only last one completes
});
```

### TC-3: Error Handling

```typescript
test('errors in workers are caught', async () => {
  let errorCaught = false;

  function* failingWorker() {
    throw new Error('Test error');
  }

  function* watcher() {
    yield takeEvery('FAIL', function* () {
      try {
        yield call(failingWorker);
      } catch (e) {
        errorCaught = true;
      }
    });
  }

  runSaga(watcher);
  dispatch({ type: 'FAIL' });

  await delay(10);
  expect(errorCaught).toBe(true);
});
```

### TC-4: Storage Watch Channel

```typescript
test('can watch storage changes in saga', async () => {
  let receivedChange = null;

  function* storageWatcher() {
    const channel = yield call(Air.watchWarm, 'user.name');

    while (true) {
      const event = yield take(channel);
      receivedChange = event;
      break;
    }
  }

  runSaga(storageWatcher);

  // Change storage value
  Air.setWarm('user.name', 'John');

  await delay(50);
  expect(receivedChange.newValue).toBe('John');
});
```

## Implementation Phases

### Phase 1: Core (MVP)

- [ ] Action dispatch system
- [ ] Basic saga runner
- [ ] Core effects: `call`, `put`, `take`, `delay`
- [ ] Watcher effects: `takeEvery`, `takeLatest`
- [ ] Basic error handling
- [ ] TypeScript types

### Phase 2: Concurrency

- [ ] `fork` and `cancel`
- [ ] `race` and `all`
- [ ] `debounce` and `throttle`
- [ ] Task management

### Phase 3: Integration

- [ ] `Air.watchWarm()` channel support
- [ ] `Air.watchCold()` channel support
- [ ] `spawn` for detached sagas
- [ ] Global error handler

### Phase 4: Polish

- [ ] DevTools support (action logging)
- [ ] Performance optimizations
- [ ] Documentation
- [ ] Migration guide from Redux-Saga

## Open Questions

1. **Pattern Matching**: Should we support Redux-Saga style pattern matching (functions, wildcards)?
2. **Middleware**: Should we support middleware for action interception?
3. **Persistence**: Should action history be persisted for debugging/replay?
4. **DevTools**: Build custom DevTools or integrate with existing (Flipper, Reactotron)?

## References

- [Redux-Saga Documentation](https://redux-saga.js.org/)
- [S.A.M Design Document](./MISSILE_DESIGN.md)
- [Generator Functions (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*)
