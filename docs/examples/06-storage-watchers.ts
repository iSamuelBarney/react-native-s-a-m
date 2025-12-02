/**
 * Example 06: Watching Storage Instead of Actions
 *
 * This example demonstrates how sagas can watch Air storage changes
 * instead of (or in addition to) actions. This is useful for:
 * - Cross-cutting concerns (analytics, sync)
 * - Reacting to state changes regardless of source
 * - Decoupled architecture
 */

import { Missile, Air } from 'react-native-s-a-m';
import type { Action, Channel } from 'react-native-s-a-m';

const { call, put, take, fork, delay, takeEvery } = Missile;

// ============================================================================
// Mock Air.watchWarm (until implemented in native)
// ============================================================================

/**
 * NOTE: Air.watchWarm is a planned feature that returns a channel
 * emitting storage change events. For now, this is a mock implementation.
 *
 * In production, use: const channel = yield call(Air.watchWarm, 'key');
 */
interface StorageEvent {
  key: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

// ============================================================================
// Pattern 1: React to Auth State Changes
// ============================================================================

/**
 * Watch for authentication state changes and react accordingly.
 * This saga doesn't care HOW the auth state changed - it just reacts.
 */
function* authStateWatcher() {
  // Create a channel that watches the auth state
  const authChannel: Channel<StorageEvent> = yield call(Air.watchWarm, 'auth.isAuthenticated');

  while (true) {
    const event: StorageEvent = yield take(authChannel);

    if (event.newValue === true && event.oldValue === false) {
      // User just logged in
      console.log('User logged in - starting user services');

      // Start user-specific background services
      Missile.register('user-sync', userSyncWatcher);
      Missile.register('notifications', notificationWatcher);

      // Track analytics
      yield put({ type: 'analytics/TRACK', payload: { event: 'login' } });

    } else if (event.newValue === false && event.oldValue === true) {
      // User just logged out
      console.log('User logged out - stopping user services');

      // Stop user-specific services
      Missile.unregister('user-sync');
      Missile.unregister('notifications');

      // Clear user data
      yield put({ type: 'user/CLEAR_DATA' });

      // Track analytics
      yield put({ type: 'analytics/TRACK', payload: { event: 'logout' } });
    }
  }
}

function* userSyncWatcher() {
  // Sync user data periodically
  while (true) {
    yield call(syncUserData);
    yield delay(60000); // Every minute
  }
}

function* notificationWatcher() {
  // Handle notifications
  yield takeEvery('notifications/RECEIVED', handleNotification);
}

function* syncUserData() {
  // Sync logic
}

function* handleNotification(action: Action) {
  // Handle notification
}

// ============================================================================
// Pattern 2: Auto-Save on Content Changes
// ============================================================================

/**
 * Automatically save content when it changes.
 * Uses debouncing to avoid saving on every keystroke.
 */
function* autoSaveWatcher() {
  const contentChannel: Channel<StorageEvent> = yield call(Air.watchWarm, 'editor.content');

  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingContent: string | null = null;

  while (true) {
    const event: StorageEvent = yield take(contentChannel);

    // Skip if content is the same (shouldn't happen, but safety check)
    if (event.newValue === event.oldValue) continue;

    pendingContent = event.newValue;

    // Debounce: Wait 2 seconds after last change before saving
    // We implement this manually since we're already in a loop
    yield call(Air.setWarm, 'editor.hasUnsavedChanges', true);

    // Race between delay and next change
    const { timeout, newChange } = yield Missile.race({
      timeout: Missile.delay(2000),
      newChange: take(contentChannel),
    });

    if (timeout && pendingContent) {
      // No new changes for 2 seconds - save now
      yield call(saveContent, pendingContent);
      yield call(Air.setWarm, 'editor.hasUnsavedChanges', false);
      pendingContent = null;
    }
    // If newChange, loop continues and waits again
  }
}

async function saveContent(content: string) {
  await fetch('/api/content', {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

// ============================================================================
// Pattern 3: Network-Aware Sync
// ============================================================================

/**
 * Watch network status and manage sync accordingly.
 */
function* networkSyncWatcher() {
  const networkChannel: Channel<StorageEvent> = yield call(Air.watchWarm, 'network.isOnline');

  while (true) {
    const event: StorageEvent = yield take(networkChannel);

    if (event.newValue === true && event.oldValue === false) {
      // Just came back online
      console.log('Back online - syncing pending changes');

      // Sync any changes made while offline
      yield put({ type: 'sync/FLUSH_OFFLINE_QUEUE' });

      // Resume real-time sync
      Missile.register('realtime-sync', realtimeSyncWatcher);

    } else if (event.newValue === false && event.oldValue === true) {
      // Just went offline
      console.log('Went offline - pausing sync');

      // Stop real-time sync (will queue changes locally)
      Missile.unregister('realtime-sync');

      // Show offline indicator
      yield call(Air.setWarm, 'ui.showOfflineIndicator', true);
    }
  }
}

function* realtimeSyncWatcher() {
  // Real-time sync logic
}

// ============================================================================
// Pattern 4: Analytics on Any State Change
// ============================================================================

/**
 * Track analytics for specific state changes.
 * This is a cross-cutting concern that watches multiple keys.
 */
function* analyticsWatcher() {
  // Watch multiple storage keys
  yield fork(watchCartAnalytics);
  yield fork(watchSearchAnalytics);
  yield fork(watchNavigationAnalytics);
}

function* watchCartAnalytics() {
  const cartChannel: Channel<StorageEvent> = yield call(Air.watchWarm, 'cart.items');

  while (true) {
    const event: StorageEvent = yield take(cartChannel);

    const oldItems = event.oldValue ? JSON.parse(event.oldValue) : [];
    const newItems = event.newValue ? JSON.parse(event.newValue) : [];

    if (newItems.length > oldItems.length) {
      // Item added
      yield call(trackEvent, 'cart_item_added', {
        itemCount: newItems.length,
      });
    } else if (newItems.length < oldItems.length) {
      // Item removed
      yield call(trackEvent, 'cart_item_removed', {
        itemCount: newItems.length,
      });
    }
  }
}

function* watchSearchAnalytics() {
  const searchChannel: Channel<StorageEvent> = yield call(Air.watchWarm, 'search.query');

  while (true) {
    const event: StorageEvent = yield take(searchChannel);

    if (event.newValue && event.newValue.length >= 3) {
      yield call(trackEvent, 'search_performed', {
        query: event.newValue,
        queryLength: event.newValue.length,
      });
    }
  }
}

function* watchNavigationAnalytics() {
  const screenChannel: Channel<StorageEvent> = yield call(Air.watchWarm, 'navigation.currentScreen');

  while (true) {
    const event: StorageEvent = yield take(screenChannel);

    yield call(trackEvent, 'screen_view', {
      screen: event.newValue,
      previousScreen: event.oldValue,
    });
  }
}

async function trackEvent(eventName: string, data: any) {
  // Send to analytics service
  console.log(`[Analytics] ${eventName}`, data);
}

// ============================================================================
// Pattern 5: Computed/Derived State
// ============================================================================

/**
 * Watch source values and compute derived state.
 * Similar to Redux selectors, but reactive.
 */
function* computedStateWatcher() {
  // Watch cart items and compute totals
  yield fork(computeCartTotals);

  // Watch filters and compute filtered results
  yield fork(computeFilteredProducts);
}

function* computeCartTotals() {
  const cartChannel: Channel<StorageEvent> = yield call(Air.watchWarm, 'cart.items');

  while (true) {
    const event: StorageEvent = yield take(cartChannel);

    const items = event.newValue ? JSON.parse(event.newValue) : [];

    // Compute totals
    const subtotal = items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0
    );
    const itemCount = items.reduce(
      (sum: number, item: any) => sum + item.quantity,
      0
    );

    // Store computed values
    yield call(Air.setWarm, 'cart.subtotal', subtotal);
    yield call(Air.setWarm, 'cart.itemCount', itemCount);
  }
}

function* computeFilteredProducts() {
  // Watch both products and filters
  const productsChannel: Channel<StorageEvent> = yield call(Air.watchWarm, 'products.all');
  const filtersChannel: Channel<StorageEvent> = yield call(Air.watchWarm, 'filters.active');

  // Get initial values
  let products: any[] = [];
  let filters: any = {};

  while (true) {
    // Wait for either to change
    const { productChange, filterChange } = yield Missile.race({
      productChange: take(productsChannel),
      filterChange: take(filtersChannel),
    });

    if (productChange) {
      products = productChange.newValue ? JSON.parse(productChange.newValue) : [];
    }
    if (filterChange) {
      filters = filterChange.newValue ? JSON.parse(filterChange.newValue) : {};
    }

    // Compute filtered products
    let filtered = [...products];

    if (filters.category) {
      filtered = filtered.filter((p) => p.category === filters.category);
    }
    if (filters.minPrice) {
      filtered = filtered.filter((p) => p.price >= filters.minPrice);
    }
    if (filters.maxPrice) {
      filtered = filtered.filter((p) => p.price <= filters.maxPrice);
    }
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(term)
      );
    }

    // Store computed result
    yield call(Air.setWarm, 'products.filtered', JSON.stringify(filtered));
    yield call(Air.setWarm, 'products.filteredCount', filtered.length);
  }
}

// ============================================================================
// Combined: Actions AND Storage
// ============================================================================

/**
 * A watcher that responds to both actions and storage changes.
 */
function* combinedWatcher() {
  // Handle explicit actions
  yield takeEvery('analytics/TRACK', trackEventWorker);

  // Also watch storage for implicit events
  yield fork(authStateWatcher);
  yield fork(analyticsWatcher);
}

function* trackEventWorker(action: Action<{ event: string; data?: any }>) {
  yield call(trackEvent, action.payload!.event, action.payload?.data);
}

// ============================================================================
// Key Takeaways
// ============================================================================

/**
 * Storage watchers are useful when:
 * 1. You don't care HOW state changed, just THAT it changed
 * 2. Multiple sources can change the same state
 * 3. You need cross-cutting concerns (analytics, sync)
 * 4. You want computed/derived state
 *
 * Action watchers are useful when:
 * 1. You need to know the INTENT behind a change
 * 2. You need the action payload (not just new value)
 * 3. You want explicit control flow
 *
 * Often you'll use BOTH in the same app:
 * - Actions for explicit user intents
 * - Storage watchers for cross-cutting concerns
 */

export {
  authStateWatcher,
  autoSaveWatcher,
  networkSyncWatcher,
  analyticsWatcher,
  computedStateWatcher,
  combinedWatcher,
};
