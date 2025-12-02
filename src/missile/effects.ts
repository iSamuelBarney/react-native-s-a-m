/**
 * Missile - Effect Creators
 *
 * Effect creators for saga control flow.
 * These functions create effect descriptors that are interpreted by the saga runner.
 */

import type {
  Action,
  CallEffect,
  PutEffect,
  TakeEffect,
  DelayEffect,
  ForkEffect,
  SpawnEffect,
  CancelEffect,
  RaceEffect,
  AllEffect,
  TakeEveryEffect,
  TakeLatestEffect,
  DebounceEffect,
  ThrottleEffect,
  Task,
  Channel,
  Pattern,
  GeneratorFunction,
  AnyEffect,
} from './types';

// ============================================================================
// Core Effects
// ============================================================================

/**
 * Creates a CALL effect.
 * When yielded, invokes the function with the given arguments.
 *
 * @example
 * ```typescript
 * const result = yield call(api.fetchUser, userId);
 * const data = yield call([obj, obj.method], arg1, arg2); // with context
 * ```
 */
export function call<T, Args extends any[]>(
  fn: (...args: Args) => T | Promise<T>,
  ...args: Args
): CallEffect<T>;
export function call<T, Args extends any[]>(
  fnWithContext: [any, (...args: Args) => T | Promise<T>],
  ...args: Args
): CallEffect<T>;
export function call<T>(
  fnOrContext: ((...args: any[]) => T | Promise<T>) | [any, (...args: any[]) => T | Promise<T>],
  ...args: any[]
): CallEffect<T> {
  if (Array.isArray(fnOrContext)) {
    const [context, fn] = fnOrContext;
    return {
      type: 'CALL',
      payload: { fn, args, context },
    };
  }

  return {
    type: 'CALL',
    payload: { fn: fnOrContext, args },
  };
}

/**
 * Creates a PUT effect.
 * When yielded, dispatches the action to the action channel.
 *
 * @example
 * ```typescript
 * yield put({ type: 'USER_LOADED', payload: user });
 * yield put({ type: 'FETCH_COMPLETE', status: 'success' });
 * ```
 */
export function put<T = any>(action: Action<T>): PutEffect {
  return {
    type: 'PUT',
    payload: action,
  };
}

/**
 * Creates a TAKE effect.
 * When yielded, blocks until an action matching the pattern is dispatched.
 *
 * @example
 * ```typescript
 * const action = yield take('LOGIN_SUCCESS');
 * const action = yield take(['LOGIN_SUCCESS', 'LOGIN_FAILURE']);
 * const action = yield take(action => action.type.startsWith('user/'));
 * ```
 */
export function take(pattern: Pattern): TakeEffect;
export function take<T>(channel: Channel<T>): TakeEffect;
export function take(patternOrChannel: Pattern | Channel<any>): TakeEffect {
  if (typeof patternOrChannel === 'object' && 'take' in patternOrChannel) {
    return {
      type: 'TAKE',
      payload: { pattern: '*', channel: patternOrChannel },
    };
  }

  return {
    type: 'TAKE',
    payload: { pattern: patternOrChannel },
  };
}

/**
 * Creates a DELAY effect.
 * When yielded, pauses execution for the specified duration.
 *
 * @example
 * ```typescript
 * yield delay(1000); // Wait 1 second
 * yield delay(5 * 60 * 1000); // Wait 5 minutes
 * ```
 */
export function delay(ms: number): DelayEffect {
  return {
    type: 'DELAY',
    payload: ms,
  };
}

// ============================================================================
// Concurrency Effects
// ============================================================================

/**
 * Creates a FORK effect.
 * When yielded, starts the saga without blocking the current saga.
 * The forked task is attached to the parent - if parent is cancelled, child is too.
 *
 * @example
 * ```typescript
 * const task = yield fork(backgroundSync);
 * const task = yield fork(fetchUser, userId);
 * ```
 */
export function fork(saga: GeneratorFunction, ...args: any[]): ForkEffect {
  return {
    type: 'FORK',
    payload: { saga, args, detached: false },
  };
}

/**
 * Creates a SPAWN effect.
 * Like fork, but creates a detached task - errors don't propagate to parent.
 *
 * @example
 * ```typescript
 * yield spawn(analyticsTracker); // Won't crash parent if it fails
 * ```
 */
export function spawn(saga: GeneratorFunction, ...args: any[]): SpawnEffect {
  return {
    type: 'SPAWN',
    payload: { saga, args, detached: true },
  };
}

/**
 * Creates a CANCEL effect.
 * When yielded, cancels the specified task(s).
 *
 * @example
 * ```typescript
 * const task = yield fork(longRunningTask);
 * yield delay(5000);
 * yield cancel(task);
 * ```
 */
export function cancel(task: Task): CancelEffect;
export function cancel(tasks: Task[]): CancelEffect;
export function cancel(taskOrTasks: Task | Task[]): CancelEffect {
  return {
    type: 'CANCEL',
    payload: taskOrTasks,
  };
}

/**
 * Creates a RACE effect.
 * When yielded, starts all effects concurrently and resolves when the first completes.
 * Other effects are automatically cancelled.
 *
 * @example
 * ```typescript
 * const { response, timeout } = yield race({
 *   response: call(api.fetch, url),
 *   timeout: delay(5000),
 * });
 *
 * if (timeout) {
 *   throw new Error('Request timed out');
 * }
 * ```
 */
export function race<T extends Record<string, AnyEffect>>(effects: T): RaceEffect<T> {
  return {
    type: 'RACE',
    payload: effects,
  };
}

/**
 * Creates an ALL effect.
 * When yielded, starts all effects concurrently and waits for all to complete.
 *
 * @example
 * ```typescript
 * const [users, products] = yield all([
 *   call(api.fetchUsers),
 *   call(api.fetchProducts),
 * ]);
 *
 * yield all({
 *   users: call(api.fetchUsers),
 *   products: call(api.fetchProducts),
 * });
 * ```
 */
export function all<T extends AnyEffect[]>(effects: T): AllEffect<T>;
export function all<T extends Record<string, AnyEffect>>(effects: T): AllEffect<T>;
export function all(effects: AnyEffect[] | Record<string, AnyEffect>): AllEffect<any> {
  return {
    type: 'ALL',
    payload: effects,
  };
}

// ============================================================================
// Watcher Effects
// ============================================================================

/**
 * Creates a TAKE_EVERY effect.
 * Spawns a saga for every action matching the pattern.
 * Does not cancel previous executions.
 *
 * @example
 * ```typescript
 * function* watchFetch() {
 *   yield takeEvery('FETCH_REQUEST', fetchSaga);
 * }
 * ```
 */
export function takeEvery(
  pattern: string | string[],
  saga: GeneratorFunction,
  ...args: any[]
): TakeEveryEffect {
  return {
    type: 'TAKE_EVERY',
    payload: { pattern, saga, args },
  };
}

/**
 * Creates a TAKE_LATEST effect.
 * Spawns a saga for the latest action matching the pattern.
 * Automatically cancels any previous execution.
 *
 * @example
 * ```typescript
 * function* watchSearch() {
 *   yield takeLatest('SEARCH_REQUEST', searchSaga);
 * }
 * ```
 */
export function takeLatest(
  pattern: string | string[],
  saga: GeneratorFunction,
  ...args: any[]
): TakeLatestEffect {
  return {
    type: 'TAKE_LATEST',
    payload: { pattern, saga, args },
  };
}

/**
 * Creates a DEBOUNCE effect.
 * Waits for a pause in actions before running the saga.
 * If a new matching action arrives before the delay, the timer resets.
 *
 * @example
 * ```typescript
 * function* watchSearch() {
 *   // Only search after user stops typing for 300ms
 *   yield debounce(300, 'SEARCH_INPUT', searchSaga);
 * }
 * ```
 */
export function debounce(
  ms: number,
  pattern: string | string[],
  saga: GeneratorFunction,
  ...args: any[]
): DebounceEffect {
  return {
    type: 'DEBOUNCE',
    payload: { ms, pattern, saga, args },
  };
}

/**
 * Creates a THROTTLE effect.
 * Runs the saga at most once per time period.
 * Actions during the cooldown period are ignored.
 *
 * @example
 * ```typescript
 * function* watchScroll() {
 *   // Handle scroll at most once per 100ms
 *   yield throttle(100, 'SCROLL', handleScroll);
 * }
 * ```
 */
export function throttle(
  ms: number,
  pattern: string | string[],
  saga: GeneratorFunction,
  ...args: any[]
): ThrottleEffect {
  return {
    type: 'THROTTLE',
    payload: { ms, pattern, saga, args },
  };
}

// ============================================================================
// Helper Effects
// ============================================================================

/**
 * Creates effect that returns immediately with a value.
 * Useful for conditional returns in sagas.
 *
 * @example
 * ```typescript
 * if (!isValid) {
 *   return yield resolve(null);
 * }
 * ```
 */
export function resolve<T>(value: T): CallEffect<T> {
  return call(() => value);
}

/**
 * Creates effect that immediately rejects with an error.
 *
 * @example
 * ```typescript
 * if (!token) {
 *   yield reject(new Error('Not authenticated'));
 * }
 * ```
 */
export function reject(error: Error): CallEffect<never> {
  return call(() => {
    throw error;
  });
}

// ============================================================================
// Type Guards
// ============================================================================

export function isEffect(obj: any): obj is AnyEffect {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'type' in obj &&
    'payload' in obj &&
    typeof obj.type === 'string'
  );
}

export function isCallEffect(effect: AnyEffect): effect is CallEffect {
  return effect.type === 'CALL';
}

export function isPutEffect(effect: AnyEffect): effect is PutEffect {
  return effect.type === 'PUT';
}

export function isTakeEffect(effect: AnyEffect): effect is TakeEffect {
  return effect.type === 'TAKE';
}

export function isDelayEffect(effect: AnyEffect): effect is DelayEffect {
  return effect.type === 'DELAY';
}

export function isForkEffect(effect: AnyEffect): effect is ForkEffect {
  return effect.type === 'FORK';
}

export function isSpawnEffect(effect: AnyEffect): effect is SpawnEffect {
  return effect.type === 'SPAWN';
}

export function isCancelEffect(effect: AnyEffect): effect is CancelEffect {
  return effect.type === 'CANCEL';
}

export function isRaceEffect(effect: AnyEffect): effect is RaceEffect {
  return effect.type === 'RACE';
}

export function isAllEffect(effect: AnyEffect): effect is AllEffect {
  return effect.type === 'ALL';
}

export function isTakeEveryEffect(effect: AnyEffect): effect is TakeEveryEffect {
  return effect.type === 'TAKE_EVERY';
}

export function isTakeLatestEffect(effect: AnyEffect): effect is TakeLatestEffect {
  return effect.type === 'TAKE_LATEST';
}

export function isDebounceEffect(effect: AnyEffect): effect is DebounceEffect {
  return effect.type === 'DEBOUNCE';
}

export function isThrottleEffect(effect: AnyEffect): effect is ThrottleEffect {
  return effect.type === 'THROTTLE';
}
