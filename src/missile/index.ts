/**
 * Missile - Action & Saga System
 *
 * Lightweight action dispatch and saga runner for S.A.M.
 * Provides a single `dispatch()` function that works anywhere.
 */

import type {
  Action,
  Task,
  TaskContext,
  TaskStatus,
  Channel,
  ChannelConfig,
  BufferType,
  Pattern,
  ActionSubscriber,
  Unsubscribe,
  GeneratorFunction,
  AnyEffect,
  SagaMiddlewareConfig,
} from './types';

import {
  isEffect,
  isCallEffect,
  isPutEffect,
  isTakeEffect,
  isDelayEffect,
  isForkEffect,
  isSpawnEffect,
  isCancelEffect,
  isRaceEffect,
  isAllEffect,
  isTakeEveryEffect,
  isTakeLatestEffect,
  isDebounceEffect,
  isThrottleEffect,
} from './effects';

// Re-export types and effects
export * from './types';
export * from './effects';

// ============================================================================
// Internal State
// ============================================================================

let taskIdCounter = 0;
const tasks = new Map<string, TaskContext>();
const taskPromises = new Map<string, Promise<any>>();
const actionSubscribers = new Set<ActionSubscriber>();
const pendingTakes = new Map<string, { pattern: Pattern; resolve: (action: Action) => void }>();
let config: SagaMiddlewareConfig = {};

// ============================================================================
// Pattern Matching
// ============================================================================

/**
 * Check if an action matches a pattern
 */
function matchesPattern(action: Action, pattern: Pattern): boolean {
  if (typeof pattern === 'string') {
    // Exact match or wildcard
    if (pattern === '*') return true;
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -1);
      return action.type.startsWith(prefix);
    }
    return action.type === pattern;
  }

  if (Array.isArray(pattern)) {
    return pattern.some((p) => matchesPattern(action, p));
  }

  if (typeof pattern === 'function') {
    return pattern(action);
  }

  return false;
}

// ============================================================================
// Channel Implementation
// ============================================================================

/**
 * Create a new channel for saga communication
 */
export function channel<T>(config: ChannelConfig = {}): Channel<T> {
  const { buffer = 'expanding', bufferSize = 10 } = config;
  const queue: T[] = [];
  const takers: Array<(value: T) => void> = [];
  let closed = false;

  return {
    take(): Promise<T> {
      return new Promise((resolve) => {
        if (queue.length > 0) {
          resolve(queue.shift()!);
        } else if (closed) {
          resolve(undefined as any); // Signal closed
        } else {
          takers.push(resolve);
        }
      });
    },

    put(value: T): void {
      if (closed) return;

      if (takers.length > 0) {
        const taker = takers.shift()!;
        taker(value);
      } else {
        // Apply buffer strategy
        if (buffer === 'none') {
          // Drop if no taker
          return;
        }

        if (buffer === 'dropping' && queue.length >= bufferSize) {
          // Drop new value
          return;
        }

        if (buffer === 'sliding' && queue.length >= bufferSize) {
          // Remove oldest
          queue.shift();
        }

        queue.push(value);

        // Enforce size for fixed buffer
        if (buffer === 'fixed' && queue.length > bufferSize) {
          queue.length = bufferSize;
        }
      }
    },

    close(): void {
      closed = true;
      // Resolve all pending takers with undefined
      takers.forEach((taker) => taker(undefined as any));
      takers.length = 0;
    },

    isClosed(): boolean {
      return closed;
    },

    flush(): T[] {
      const items = [...queue];
      queue.length = 0;
      return items;
    },
  };
}

// Note: We use pendingTakes for action matching instead of a channel
// This avoids unbounded memory growth from buffered actions

// ============================================================================
// Task Implementation
// ============================================================================

/**
 * Create a Task from a TaskContext
 */
function createTask(ctx: TaskContext): Task {
  return {
    id: ctx.id,

    isRunning(): boolean {
      return ctx.status === 'running';
    },

    isCancelled(): boolean {
      return ctx.status === 'cancelled';
    },

    isAborted(): boolean {
      return ctx.status === 'aborted';
    },

    result(): any {
      return ctx.result;
    },

    error(): Error | null {
      return ctx.error || null;
    },

    toPromise(): Promise<any> {
      // Return cached promise to avoid race conditions with multiple callers
      if (!taskPromises.has(ctx.id)) {
        const promise = new Promise((resolve, reject) => {
          if (ctx.status === 'completed') {
            resolve(ctx.result);
          } else if (ctx.status === 'aborted') {
            reject(ctx.error);
          } else if (ctx.status === 'cancelled') {
            reject(new Error('Task was cancelled'));
          } else {
            // Still running, wait for completion
            const originalResolve = ctx.resolve;
            const originalReject = ctx.reject;

            ctx.resolve = (value) => {
              originalResolve(value);
              resolve(value);
            };

            ctx.reject = (error) => {
              originalReject(error);
              reject(error);
            };
          }
        });
        taskPromises.set(ctx.id, promise);
      }
      return taskPromises.get(ctx.id)!;
    },

    cancel(): void {
      cancelTask(ctx.id);
    },
  };
}

/**
 * Cancel a task by ID
 */
function cancelTask(taskId: string): void {
  const ctx = tasks.get(taskId);
  if (!ctx || ctx.status !== 'running') return;

  ctx.status = 'cancelled';

  // Cancel all children
  ctx.children.forEach((childId) => cancelTask(childId));

  // Run cancel callbacks
  ctx.cancelCallbacks.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      // Ignore cancel callback errors
    }
  });

  // Try to return from generator
  try {
    ctx.generator.return(undefined);
  } catch (e) {
    // Ignore
  }

  // Reject any pending promise
  ctx.reject(new Error('Task was cancelled'));

  tasks.delete(taskId);
  taskPromises.delete(taskId);
}

// ============================================================================
// Effect Runner
// ============================================================================

/**
 * Run a single effect and return its result
 */
async function runEffect(effect: AnyEffect, ctx: TaskContext): Promise<any> {
  if (ctx.status !== 'running') {
    throw new Error('Task cancelled');
  }

  if (isCallEffect(effect)) {
    const { fn, args, context } = effect.payload;
    return context ? fn.apply(context, args) : fn(...args);
  }

  if (isPutEffect(effect)) {
    dispatch(effect.payload);
    return effect.payload;
  }

  if (isTakeEffect(effect)) {
    const { pattern, channel: ch } = effect.payload;

    if (ch) {
      // Take from specific channel
      return ch.take();
    }

    // Take from action channel
    return new Promise<Action>((resolve) => {
      const takeId = `take_${Date.now()}_${Math.random()}`;
      pendingTakes.set(takeId, { pattern, resolve });

      // Register cancel callback
      ctx.cancelCallbacks.push(() => {
        pendingTakes.delete(takeId);
      });
    });
  }

  if (isDelayEffect(effect)) {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, effect.payload);
      ctx.cancelCallbacks.push(() => clearTimeout(timer));
    });
  }

  if (isForkEffect(effect) || isSpawnEffect(effect)) {
    const { saga, args, detached } = effect.payload;
    const task = runSagaInternal(saga, args, detached ? undefined : ctx.id);
    return task;
  }

  if (isCancelEffect(effect)) {
    const taskOrTasks = effect.payload;
    if (Array.isArray(taskOrTasks)) {
      taskOrTasks.forEach((t) => cancelTask(t.id));
    } else {
      cancelTask(taskOrTasks.id);
    }
    return undefined;
  }

  if (isRaceEffect(effect)) {
    const effects = effect.payload as Record<string, AnyEffect>;
    const keys = Object.keys(effects);

    // Handle empty race - resolve with empty object
    if (keys.length === 0) {
      return {};
    }

    return new Promise((resolve, reject) => {
      let resolved = false;
      const results: Record<string, any> = {};
      const childTasks: Task[] = [];

      keys.forEach((key) => {
        const eff = effects[key];

        // Create a mini saga for each effect
        const task = runSagaInternal(
          function* () {
            return yield eff;
          },
          [],
          ctx.id
        );

        childTasks.push(task);

        task.toPromise().then(
          (result) => {
            if (!resolved) {
              resolved = true;
              results[key] = result;
              // Cancel other tasks
              childTasks.forEach((t) => {
                if (t.id !== task.id) t.cancel();
              });
              resolve(results);
            }
          },
          (error) => {
            if (!resolved) {
              resolved = true;
              // Cancel all tasks on error
              childTasks.forEach((t) => t.cancel());
              reject(error);
            }
          }
        );
      });
    });
  }

  if (isAllEffect(effect)) {
    const effects = effect.payload;
    const isArray = Array.isArray(effects);
    const effectsArray = isArray ? effects : Object.values(effects);
    const keys = isArray ? effectsArray.map((_, i) => i) : Object.keys(effects);

    // Handle empty all - return empty array/object immediately
    if (effectsArray.length === 0) {
      return isArray ? [] : {};
    }

    const childTasks: Task[] = [];
    const promises = effectsArray.map((eff) => {
      const task = runSagaInternal(
        function* () {
          return yield eff;
        },
        [],
        ctx.id
      );
      childTasks.push(task);
      return task.toPromise();
    });

    try {
      const results = await Promise.all(promises);

      if (isArray) {
        return results;
      }

      const resultObj: Record<string, any> = {};
      keys.forEach((key, i) => {
        resultObj[key as string] = results[i];
      });
      return resultObj;
    } catch (error) {
      // Cancel all tasks on error
      childTasks.forEach((t) => t.cancel());
      throw error;
    }
  }

  if (isTakeEveryEffect(effect)) {
    const { pattern, saga, args = [] } = effect.payload;

    // Fork a watcher that handles every matching action
    return runSagaInternal(
      function* () {
        while (true) {
          const action: Action = yield { type: 'TAKE', payload: { pattern } };
          // Fork the worker (don't wait)
          yield { type: 'FORK', payload: { saga, args: [action, ...args], detached: false } };
        }
      },
      [],
      ctx.id
    );
  }

  if (isTakeLatestEffect(effect)) {
    const { pattern, saga, args = [] } = effect.payload;

    return runSagaInternal(
      function* () {
        let lastTask: Task | null = null;

        while (true) {
          const action: Action = yield { type: 'TAKE', payload: { pattern } };

          // Cancel previous task
          if (lastTask && lastTask.isRunning()) {
            yield { type: 'CANCEL', payload: lastTask };
          }

          // Fork new worker
          lastTask = yield { type: 'FORK', payload: { saga, args: [action, ...args], detached: false } };
        }
      },
      [],
      ctx.id
    );
  }

  if (isDebounceEffect(effect)) {
    const { ms, pattern, saga, args = [] } = effect.payload;

    // Debounce implementation using a channel-based approach
    return runSagaInternal(
      function* () {
        // We use race with delay to implement debounce properly
        let lastAction: Action | null = null;

        while (true) {
          if (lastAction === null) {
            // Wait for first action
            lastAction = yield { type: 'TAKE', payload: { pattern } };
          }

          // Race between timeout and new action
          const result: { timeout?: true; action?: Action } = yield {
            type: 'RACE',
            payload: {
              timeout: { type: 'DELAY', payload: ms },
              action: { type: 'TAKE', payload: { pattern } },
            },
          };

          if (result.action) {
            // New action arrived, reset timer
            lastAction = result.action;
          } else {
            // Timeout won, execute the saga with last action
            yield { type: 'FORK', payload: { saga, args: [lastAction, ...args], detached: false } };
            lastAction = null;
          }
        }
      },
      [],
      ctx.id
    );
  }

  if (isThrottleEffect(effect)) {
    const { ms, pattern, saga, args = [] } = effect.payload;

    return runSagaInternal(
      function* () {
        let lastRun = 0;

        while (true) {
          const action: Action = yield { type: 'TAKE', payload: { pattern } };
          const now = Date.now();

          if (now - lastRun >= ms) {
            lastRun = now;
            yield { type: 'FORK', payload: { saga, args: [action, ...args], detached: false } };
          }
        }
      },
      [],
      ctx.id
    );
  }

  throw new Error(`Unknown effect type: ${(effect as any).type}`);
}

// ============================================================================
// Saga Runner
// ============================================================================

/**
 * Internal saga runner
 */
function runSagaInternal(
  saga: GeneratorFunction,
  args: any[],
  parentId?: string
): Task {
  const id = `task_${++taskIdCounter}`;

  let resolvePromise: (value: any) => void;
  let rejectPromise: (error: Error) => void;

  const promise = new Promise<any>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const generator = saga(...args);

  const ctx: TaskContext = {
    id,
    status: 'running',
    generator,
    parentId,
    children: new Set(),
    cancelCallbacks: [],
    resolve: resolvePromise!,
    reject: rejectPromise!,
  };

  tasks.set(id, ctx);

  // Register as child of parent
  if (parentId) {
    const parent = tasks.get(parentId);
    if (parent) {
      parent.children.add(id);
    }
  }

  // Run the generator
  runGenerator(ctx);

  return createTask(ctx);
}

/**
 * Run a generator to completion
 */
async function runGenerator(ctx: TaskContext): Promise<void> {
  let result: IteratorResult<any>;
  let nextValue: any;

  try {
    while (ctx.status === 'running') {
      result = ctx.generator.next(nextValue);

      if (result.done) {
        ctx.status = 'completed';
        ctx.result = result.value;
        ctx.resolve(result.value);
        break;
      }

      const yielded = result.value;

      if (isEffect(yielded)) {
        try {
          nextValue = await runEffect(yielded, ctx);
        } catch (error) {
          // Try to throw into the generator
          result = ctx.generator.throw(error);
          if (result.done) {
            ctx.status = 'completed';
            ctx.result = result.value;
            ctx.resolve(result.value);
            break;
          }
          nextValue = result.value;
        }
      } else {
        // Not an effect, just pass through
        nextValue = yielded;
      }
    }
  } catch (error) {
    ctx.status = 'aborted';
    ctx.error = error as Error;
    ctx.reject(error as Error);

    // Call global error handler
    if (config.onError) {
      config.onError(error as Error, { sagaId: ctx.id });
    } else if (config.debug) {
      console.error(`[Missile] Uncaught error in saga ${ctx.id}:`, error);
    }
  } finally {
    // Clean up
    if (ctx.parentId) {
      const parent = tasks.get(ctx.parentId);
      if (parent) {
        parent.children.delete(ctx.id);
      }
    }

    if (ctx.status === 'completed' || ctx.status === 'aborted') {
      tasks.delete(ctx.id);
      taskPromises.delete(ctx.id);
    }
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Dispatch an action to all registered sagas.
 * Works anywhere - components, utilities, interceptors, etc.
 *
 * @example
 * ```typescript
 * dispatch({ type: 'auth/LOGIN', payload: { email, password } });
 * dispatch({ type: 'cart/ADD_ITEM', payload: { productId }, status: 'pending' });
 * ```
 */
export function dispatch<T = any>(action: Action<T>): void {
  if (!action || typeof action.type !== 'string') {
    throw new Error('Action must have a type property');
  }

  // Notify subscribers
  actionSubscribers.forEach((subscriber) => {
    try {
      subscriber(action);
    } catch (e) {
      if (config.debug) {
        console.error('[Missile] Error in action subscriber:', e);
      }
    }
  });

  // Resolve pending takes
  pendingTakes.forEach((pending, takeId) => {
    if (matchesPattern(action, pending.pattern)) {
      pending.resolve(action);
      pendingTakes.delete(takeId);
    }
  });
}

/**
 * Register and run a saga.
 * Call at app startup to register your watchers.
 *
 * @example
 * ```typescript
 * runSaga(authWatcher);
 * runSaga(cartWatcher);
 * ```
 */
export function runSaga(saga: GeneratorFunction, ...args: any[]): Task {
  return runSagaInternal(saga, args);
}

/**
 * Cancel a running saga.
 *
 * @example
 * ```typescript
 * const task = runSaga(mySaga);
 * // Later...
 * cancelSaga(task);
 * ```
 */
export function cancelSaga(task: Task): void {
  cancelTask(task.id);
}

/**
 * Subscribe to all dispatched actions.
 * Useful for debugging and logging.
 *
 * @example
 * ```typescript
 * const unsubscribe = subscribe((action) => {
 *   console.log('Action:', action.type);
 * });
 * ```
 */
export function subscribe(subscriber: ActionSubscriber): Unsubscribe {
  actionSubscribers.add(subscriber);
  return () => actionSubscribers.delete(subscriber);
}

/**
 * Configure the saga middleware.
 *
 * @example
 * ```typescript
 * configure({
 *   debug: __DEV__,
 *   onError: (error, { sagaId }) => {
 *     crashReporter.log(error);
 *   },
 * });
 * ```
 */
export function configure(options: SagaMiddlewareConfig): void {
  config = { ...config, ...options };
}

/**
 * Get all running tasks.
 * Useful for debugging.
 */
export function getRunningTasks(): Task[] {
  return Array.from(tasks.values())
    .filter((ctx) => ctx.status === 'running')
    .map(createTask);
}

/**
 * Cancel all running tasks.
 * Useful for cleanup on app shutdown.
 */
export function cancelAllTasks(): void {
  // Cancel root tasks (those without parents)
  tasks.forEach((ctx) => {
    if (!ctx.parentId) {
      cancelTask(ctx.id);
    }
  });
}

// ============================================================================
// Named Saga Registry
// ============================================================================

const namedSagas = new Map<string, Task>();

/**
 * Register a named saga that can be started/stopped by name.
 * If a saga with the same name is already running, it will be stopped first.
 *
 * @example
 * ```typescript
 * // Start a watcher when entering a screen
 * Missile.register('cart-watcher', cartWatcher);
 *
 * // Stop it when leaving
 * Missile.unregister('cart-watcher');
 *
 * // Check if running
 * if (Missile.isRegistered('cart-watcher')) { ... }
 * ```
 */
export function register(name: string, saga: GeneratorFunction, ...args: any[]): Task {
  // Stop existing saga with same name
  if (namedSagas.has(name)) {
    unregister(name);
  }

  const task = runSagaInternal(saga, args);
  namedSagas.set(name, task);

  // Clean up when task completes
  task.toPromise()
    .catch(() => {}) // Ignore errors
    .finally(() => {
      // Only delete if it's still the same task
      if (namedSagas.get(name) === task) {
        namedSagas.delete(name);
      }
    });

  return task;
}

/**
 * Unregister and stop a named saga.
 *
 * @example
 * ```typescript
 * Missile.unregister('cart-watcher');
 * ```
 */
export function unregister(name: string): boolean {
  const task = namedSagas.get(name);
  if (task) {
    task.cancel();
    namedSagas.delete(name);
    return true;
  }
  return false;
}

/**
 * Check if a named saga is registered and running.
 *
 * @example
 * ```typescript
 * if (!Missile.isRegistered('auth-watcher')) {
 *   Missile.register('auth-watcher', authWatcher);
 * }
 * ```
 */
export function isRegistered(name: string): boolean {
  const task = namedSagas.get(name);
  return task !== undefined && task.isRunning();
}

/**
 * Get a registered saga's task by name.
 *
 * @example
 * ```typescript
 * const task = Missile.getRegistered('cart-watcher');
 * if (task?.isRunning()) { ... }
 * ```
 */
export function getRegistered(name: string): Task | undefined {
  return namedSagas.get(name);
}

/**
 * Get all registered saga names.
 *
 * @example
 * ```typescript
 * const names = Missile.getRegisteredNames();
 * // ['auth-watcher', 'cart-watcher', 'analytics-watcher']
 * ```
 */
export function getRegisteredNames(): string[] {
  return Array.from(namedSagas.keys());
}

/**
 * Unregister and stop all named sagas.
 *
 * @example
 * ```typescript
 * // On app logout, stop all watchers
 * Missile.unregisterAll();
 * ```
 */
export function unregisterAll(): void {
  namedSagas.forEach((task) => task.cancel());
  namedSagas.clear();
}
