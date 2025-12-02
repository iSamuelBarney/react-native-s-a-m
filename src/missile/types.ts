/**
 * Missile - Action & Saga System Types
 *
 * Type definitions for the Missile dispatch and saga system.
 */

// ============================================================================
// Action Types
// ============================================================================

/**
 * Action status for lifecycle tracking
 */
export type ActionStatus = 'pending' | 'success' | 'error' | string;

/**
 * Base action interface
 */
export interface Action<T = any> {
  /** Action type identifier (required) */
  type: string;

  /** Action payload data (optional) */
  payload?: T;

  /** Action status for lifecycle tracking (optional) */
  status?: ActionStatus;
}

/**
 * Action creator function type
 */
export type ActionCreator<P = void> = P extends void
  ? () => Action<void>
  : (payload: P) => Action<P>;

// ============================================================================
// Effect Types
// ============================================================================

/**
 * Effect type identifiers
 */
export type EffectType =
  | 'CALL'
  | 'PUT'
  | 'TAKE'
  | 'DELAY'
  | 'FORK'
  | 'SPAWN'
  | 'CANCEL'
  | 'RACE'
  | 'ALL'
  | 'TAKE_EVERY'
  | 'TAKE_LATEST'
  | 'DEBOUNCE'
  | 'THROTTLE';

/**
 * Base effect interface
 */
export interface Effect<T = any> {
  type: EffectType;
  payload: T;
}

/**
 * Call effect - invokes a function
 */
export interface CallEffect<T = any> extends Effect<CallEffectPayload<T>> {
  type: 'CALL';
}

export interface CallEffectPayload<T = any> {
  fn: (...args: any[]) => T | Promise<T>;
  args: any[];
  context?: any;
}

/**
 * Put effect - dispatches an action
 */
export interface PutEffect extends Effect<Action> {
  type: 'PUT';
}

/**
 * Take effect - waits for an action
 */
export interface TakeEffect extends Effect<TakeEffectPayload> {
  type: 'TAKE';
}

export interface TakeEffectPayload {
  pattern: string | string[] | ((action: Action) => boolean);
  channel?: Channel<any>;
}

/**
 * Delay effect - pauses execution
 */
export interface DelayEffect extends Effect<number> {
  type: 'DELAY';
}

/**
 * Fork effect - non-blocking saga execution
 */
export interface ForkEffect extends Effect<ForkEffectPayload> {
  type: 'FORK';
}

export interface ForkEffectPayload {
  saga: GeneratorFunction;
  args: any[];
  detached?: boolean;
}

/**
 * Spawn effect - detached saga execution
 */
export interface SpawnEffect extends Effect<ForkEffectPayload> {
  type: 'SPAWN';
}

/**
 * Cancel effect - cancels a task
 */
export interface CancelEffect extends Effect<Task | Task[]> {
  type: 'CANCEL';
}

/**
 * Race effect - first to complete wins
 */
export interface RaceEffect<T = Record<string, Effect>> extends Effect<T> {
  type: 'RACE';
}

/**
 * All effect - wait for all to complete
 */
export interface AllEffect<T = Effect[]> extends Effect<T> {
  type: 'ALL';
}

/**
 * TakeEvery effect - handle every matching action
 */
export interface TakeEveryEffect extends Effect<WatcherEffectPayload> {
  type: 'TAKE_EVERY';
}

/**
 * TakeLatest effect - handle only latest action
 */
export interface TakeLatestEffect extends Effect<WatcherEffectPayload> {
  type: 'TAKE_LATEST';
}

/**
 * Debounce effect - wait for pause before handling
 */
export interface DebounceEffect extends Effect<TimedWatcherEffectPayload> {
  type: 'DEBOUNCE';
}

/**
 * Throttle effect - limit handling frequency
 */
export interface ThrottleEffect extends Effect<TimedWatcherEffectPayload> {
  type: 'THROTTLE';
}

export interface WatcherEffectPayload {
  pattern: string | string[];
  saga: GeneratorFunction;
  args?: any[];
}

export interface TimedWatcherEffectPayload extends WatcherEffectPayload {
  ms: number;
}

/**
 * Union of all effect types
 */
export type AnyEffect =
  | CallEffect
  | PutEffect
  | TakeEffect
  | DelayEffect
  | ForkEffect
  | SpawnEffect
  | CancelEffect
  | RaceEffect
  | AllEffect
  | TakeEveryEffect
  | TakeLatestEffect
  | DebounceEffect
  | ThrottleEffect;

// ============================================================================
// Task Types
// ============================================================================

/**
 * Task status
 */
export type TaskStatus = 'running' | 'completed' | 'cancelled' | 'aborted';

/**
 * Task interface for managing saga execution
 */
export interface Task<T = any> {
  /** Unique task identifier */
  id: string;

  /** Whether the task is still running */
  isRunning(): boolean;

  /** Whether the task was cancelled */
  isCancelled(): boolean;

  /** Whether the task completed with error */
  isAborted(): boolean;

  /** Get the task result (if completed) */
  result(): T | undefined;

  /** Get the task error (if aborted) */
  error(): Error | null;

  /** Promise that resolves when task completes */
  toPromise(): Promise<T>;

  /** Cancel the task */
  cancel(): void;
}

/**
 * Internal task context
 */
export interface TaskContext {
  id: string;
  status: TaskStatus;
  result?: any;
  error?: Error;
  generator: Generator;
  parentId?: string;
  children: Set<string>;
  cancelCallbacks: Array<() => void>;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

// ============================================================================
// Channel Types
// ============================================================================

/**
 * Channel for communication between sagas
 */
export interface Channel<T = any> {
  /** Take the next value from the channel (blocking) */
  take(): Promise<T>;

  /** Put a value into the channel */
  put(value: T): void;

  /** Close the channel */
  close(): void;

  /** Whether the channel is closed */
  isClosed(): boolean;

  /** Flush all pending values */
  flush(): T[];
}

/**
 * Event emitted when storage changes
 */
export interface StorageChangeEvent {
  key: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

/**
 * Buffering strategy for channels
 */
export type BufferType = 'none' | 'fixed' | 'expanding' | 'dropping' | 'sliding';

export interface ChannelConfig {
  buffer?: BufferType;
  bufferSize?: number;
}

// ============================================================================
// Saga Types
// ============================================================================

/**
 * Generator function type for sagas
 */
export type Saga<Args extends any[] = any[], Return = any> = (
  ...args: Args
) => Generator<AnyEffect, Return, any>;

/**
 * Saga middleware configuration
 */
export interface SagaMiddlewareConfig {
  /** Called when an error is not caught */
  onError?: (error: Error, context: { sagaId: string; action?: Action }) => void;

  /** Enable debug logging */
  debug?: boolean;

  /** Maximum number of concurrent tasks */
  maxConcurrentTasks?: number;
}

// ============================================================================
// Pattern Matching Types
// ============================================================================

/**
 * Pattern for matching actions
 */
export type Pattern =
  | string
  | string[]
  | ((action: Action) => boolean);

/**
 * Check if action matches pattern
 */
export type PatternMatcher = (action: Action, pattern: Pattern) => boolean;

// ============================================================================
// Subscriber Types
// ============================================================================

/**
 * Action subscriber callback
 */
export type ActionSubscriber = (action: Action) => void;

/**
 * Unsubscribe function
 */
export type Unsubscribe = () => void;

// ============================================================================
// Effect Result Types
// ============================================================================

/**
 * Result of a race effect
 */
export type RaceResult<T extends Record<string, Effect>> = {
  [K in keyof T]?: T[K] extends Effect<infer R> ? R : never;
};

/**
 * Result of an all effect
 */
export type AllResult<T extends Effect[]> = {
  [K in keyof T]: T[K] extends Effect<infer R> ? R : never;
};

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extract payload type from action
 */
export type PayloadOf<A extends Action> = A extends Action<infer P> ? P : never;

/**
 * Create typed action creator
 */
export type TypedActionCreator<T extends string, P = void> = P extends void
  ? { type: T; (): Action<void> & { type: T } }
  : { type: T; (payload: P): Action<P> & { type: T } };

/**
 * Generator function constraint
 */
export type GeneratorFunction = (...args: any[]) => Generator<any, any, any>;
