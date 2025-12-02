/**
 * Example 05: Advanced Effects
 *
 * This example demonstrates advanced effect patterns:
 * - race() for timeouts and cancellation
 * - all() for parallel operations
 * - Channels for saga communication
 * - Complex async flows
 */

import { Missile, Air } from 'react-native-s-a-m';
import type { Action, Task, Channel } from 'react-native-s-a-m';

const { call, put, take, fork, cancel, race, all, delay, takeLatest, channel } = Missile;

// ============================================================================
// Pattern 1: Request with Timeout
// ============================================================================

/**
 * Fetch data with a timeout.
 * If the request takes too long, cancel it and show an error.
 */
function* fetchWithTimeout(url: string, timeoutMs: number = 10000) {
  const { response, timeout } = yield race({
    response: call(fetch, url),
    timeout: delay(timeoutMs),
  });

  if (timeout) {
    throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
  }

  return response;
}

/**
 * Usage in a worker
 */
function* fetchDataWorker(action: Action<{ endpoint: string }>) {
  try {
    yield call(Air.setWarm, 'data.loading', true);

    // 5 second timeout
    const response = yield call(fetchWithTimeout, action.payload!.endpoint, 5000);
    const data = yield call([response, response.json]);

    yield call(Air.setWarm, 'data.result', JSON.stringify(data));
    yield put({ type: 'data/FETCH_SUCCESS', payload: data });

  } catch (error: any) {
    yield call(Air.setWarm, 'data.error', error.message);
    yield put({ type: 'data/FETCH_FAILURE', payload: error.message });
  } finally {
    yield call(Air.setWarm, 'data.loading', false);
  }
}

// ============================================================================
// Pattern 2: User Confirmation with Timeout
// ============================================================================

/**
 * Wait for user to confirm an action, with auto-cancel after timeout.
 */
function* confirmationWithTimeout(promptKey: string, timeoutMs: number = 30000) {
  // Show confirmation dialog
  yield call(Air.setWarm, promptKey, true);

  const { confirmed, cancelled, timeout } = yield race({
    confirmed: take('dialog/CONFIRMED'),
    cancelled: take('dialog/CANCELLED'),
    timeout: delay(timeoutMs),
  });

  // Hide dialog
  yield call(Air.setWarm, promptKey, false);

  if (confirmed) return true;
  if (cancelled) return false;
  if (timeout) return false; // Auto-cancel on timeout
}

function* deleteAccountWorker() {
  // Ask for confirmation
  const confirmed = yield call(
    confirmationWithTimeout,
    'ui.deleteAccountDialog',
    60000 // 1 minute to decide
  );

  if (!confirmed) {
    yield put({ type: 'account/DELETE_CANCELLED' });
    return;
  }

  // Proceed with deletion
  yield call(deleteUserAccount);
  yield put({ type: 'account/DELETE_SUCCESS' });
}

async function deleteUserAccount() {
  // Delete account API call
}

// ============================================================================
// Pattern 3: Parallel Data Loading
// ============================================================================

/**
 * Load multiple data sources in parallel.
 * Wait for all to complete before proceeding.
 */
function* loadDashboardData() {
  yield call(Air.setWarm, 'dashboard.loading', true);

  try {
    // Load all data in parallel
    const { user, stats, notifications, recentActivity } = yield all({
      user: call(fetchUserProfile),
      stats: call(fetchDashboardStats),
      notifications: call(fetchNotifications),
      recentActivity: call(fetchRecentActivity),
    });

    // All data loaded - update state
    yield call(Air.setWarm, 'dashboard.user', JSON.stringify(user));
    yield call(Air.setWarm, 'dashboard.stats', JSON.stringify(stats));
    yield call(Air.setWarm, 'dashboard.notifications', JSON.stringify(notifications));
    yield call(Air.setWarm, 'dashboard.recentActivity', JSON.stringify(recentActivity));

    yield put({ type: 'dashboard/LOAD_SUCCESS' });

  } catch (error: any) {
    // If ANY request fails, the whole all() fails
    yield put({ type: 'dashboard/LOAD_FAILURE', payload: error.message });
  } finally {
    yield call(Air.setWarm, 'dashboard.loading', false);
  }
}

async function fetchUserProfile() {
  const res = await fetch('/api/user/profile');
  return res.json();
}

async function fetchDashboardStats() {
  const res = await fetch('/api/dashboard/stats');
  return res.json();
}

async function fetchNotifications() {
  const res = await fetch('/api/notifications');
  return res.json();
}

async function fetchRecentActivity() {
  const res = await fetch('/api/activity/recent');
  return res.json();
}

// ============================================================================
// Pattern 4: Cancellable Background Task
// ============================================================================

/**
 * A background task that can be started and stopped.
 */
function* pollingWorker(endpoint: string, intervalMs: number) {
  while (true) {
    try {
      const response = yield call(fetch, endpoint);
      const data = yield call([response, response.json]);

      yield put({ type: 'polling/DATA_RECEIVED', payload: data });

    } catch (error: any) {
      console.error('Polling error:', error);
      // Continue polling despite errors
    }

    yield delay(intervalMs);
  }
}

/**
 * Watcher that manages the polling lifecycle
 */
function* pollingManagerWatcher() {
  let pollingTask: Task | null = null;

  while (true) {
    const action: Action = yield take(['polling/START', 'polling/STOP']);

    if (action.type === 'polling/START') {
      // Cancel existing polling if any
      if (pollingTask && pollingTask.isRunning()) {
        yield cancel(pollingTask);
      }

      // Start new polling
      pollingTask = yield fork(
        pollingWorker,
        action.payload!.endpoint,
        action.payload!.interval || 5000
      );

    } else if (action.type === 'polling/STOP') {
      if (pollingTask && pollingTask.isRunning()) {
        yield cancel(pollingTask);
        pollingTask = null;
      }
    }
  }
}

// ============================================================================
// Pattern 5: Channels for Saga Communication
// ============================================================================

/**
 * Use channels to communicate between sagas.
 * Useful for producer/consumer patterns.
 */

interface QueueItem {
  id: string;
  data: any;
  priority: number;
}

/**
 * Producer: Adds items to a processing queue
 */
function* queueProducer(ch: Channel<QueueItem>) {
  yield takeEvery('queue/ADD_ITEM', function* (action: Action<QueueItem>) {
    // Put item in channel for processing
    ch.put(action.payload!);
    yield put({ type: 'queue/ITEM_QUEUED', payload: action.payload!.id });
  });
}

/**
 * Consumer: Processes items from the queue
 */
function* queueConsumer(ch: Channel<QueueItem>) {
  while (true) {
    // Wait for next item
    const item: QueueItem = yield take(ch);

    if (!item) {
      // Channel closed
      break;
    }

    yield call(Air.setWarm, `queue.processing.${item.id}`, true);

    try {
      // Process the item
      yield call(processQueueItem, item);

      yield put({ type: 'queue/ITEM_PROCESSED', payload: item.id });

    } catch (error: any) {
      yield put({
        type: 'queue/ITEM_FAILED',
        payload: { id: item.id, error: error.message },
      });
    } finally {
      yield call(Air.setWarm, `queue.processing.${item.id}`, false);
    }
  }
}

async function processQueueItem(item: QueueItem) {
  // Process the item
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

/**
 * Setup the queue system
 */
function* queueSystemSaga() {
  // Create a channel with a buffer
  const queueChannel = channel<QueueItem>({
    buffer: 'expanding',
    bufferSize: 100,
  });

  // Start producer and consumer
  yield fork(queueProducer, queueChannel);
  yield fork(queueConsumer, queueChannel);

  // Wait for shutdown signal
  yield take('queue/SHUTDOWN');

  // Close the channel
  queueChannel.close();
}

// ============================================================================
// Pattern 6: Retry with Exponential Backoff
// ============================================================================

/**
 * Retry a function with exponential backoff.
 */
function* retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Generator<any, T, any> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result: T = yield call(fn);
      return result;
    } catch (error: any) {
      lastError = error;

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, 8s...
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        console.log(`Retry ${attempt + 1}/${maxRetries} after ${delayMs}ms`);
        yield delay(delayMs);
      }
    }
  }

  throw lastError!;
}

/**
 * Usage
 */
function* reliableFetchWorker(action: Action<{ url: string }>) {
  try {
    const data = yield call(function* () {
      return yield* retryWithBackoff(
        async () => {
          const res = await fetch(action.payload!.url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        },
        3, // Max 3 retries
        1000 // Start with 1 second delay
      );
    });

    yield put({ type: 'fetch/SUCCESS', payload: data });

  } catch (error: any) {
    // All retries failed
    yield put({ type: 'fetch/FAILURE', payload: error.message });
  }
}

// ============================================================================
// Pattern 7: Optimistic Updates with Rollback
// ============================================================================

/**
 * Optimistically update the UI, then rollback if the API call fails.
 */
function* optimisticUpdateWorker(action: Action<{ itemId: string; newValue: string }>) {
  const { itemId, newValue } = action.payload!;

  // Save current value for potential rollback
  const previousValue = yield call(Air.getWarm, `items.${itemId}`);

  // Optimistically update
  yield call(Air.setWarm, `items.${itemId}`, newValue);
  yield put({ type: 'items/UPDATE_OPTIMISTIC', payload: { itemId, newValue } });

  try {
    // Try to persist to server
    yield call(updateItemOnServer, itemId, newValue);

    yield put({ type: 'items/UPDATE_CONFIRMED', payload: { itemId } });

  } catch (error: any) {
    // Rollback on failure
    yield call(Air.setWarm, `items.${itemId}`, previousValue);

    yield put({
      type: 'items/UPDATE_ROLLBACK',
      payload: { itemId, previousValue, error: error.message },
    });
  }
}

async function updateItemOnServer(itemId: string, value: string) {
  const res = await fetch(`/api/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error('Update failed');
}

// ============================================================================
// Key Takeaways
// ============================================================================

/**
 * race() patterns:
 * - Request timeout
 * - User confirmation with auto-cancel
 * - First response wins
 *
 * all() patterns:
 * - Parallel data loading
 * - Batch operations
 *
 * Channel patterns:
 * - Producer/consumer queues
 * - Rate limiting
 * - Saga communication
 *
 * Other patterns:
 * - Retry with backoff
 * - Optimistic updates
 * - Cancellable background tasks
 */

export {
  fetchWithTimeout,
  confirmationWithTimeout,
  loadDashboardData,
  pollingManagerWatcher,
  queueSystemSaga,
  retryWithBackoff,
  optimisticUpdateWorker,
};
