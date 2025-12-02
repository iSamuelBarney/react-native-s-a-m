/**
 * Example 04: Dynamic Watcher Registration
 *
 * This example demonstrates how to start and stop sagas dynamically:
 * - Screen-based watchers (start on focus, stop on blur)
 * - Feature-based watchers (enabled/disabled by user settings)
 * - Conditional watchers (based on app state)
 */

import { Missile, Air, useWarm } from 'react-native-s-a-m';
import type { Action } from 'react-native-s-a-m';

const { call, put, take, fork, delay, takeLatest, takeEvery } = Missile;

// ============================================================================
// Example 1: Screen-Based Watchers
// ============================================================================

/**
 * A watcher specific to the Checkout screen.
 * Only runs while user is on the checkout screen.
 */
function* checkoutWatcher() {
  yield takeLatest('checkout/VALIDATE_CART', validateCartWorker);
  yield takeLatest('checkout/APPLY_COUPON', applyCouponWorker);
  yield takeLatest('checkout/SUBMIT_ORDER', submitOrderWorker);
  yield takeEvery('checkout/UPDATE_QUANTITY', updateQuantityWorker);
}

function* validateCartWorker(action: Action) {
  // Validate cart contents
  yield call(Air.setWarm, 'checkout.validating', true);
  // ... validation logic
  yield call(Air.setWarm, 'checkout.validating', false);
}

function* applyCouponWorker(action: Action<{ code: string }>) {
  // Apply coupon
}

function* submitOrderWorker(action: Action) {
  // Submit the order
}

function* updateQuantityWorker(action: Action<{ itemId: string; quantity: number }>) {
  // Update item quantity
}

/**
 * React Navigation integration
 *
 * Start the checkout watcher when entering the screen,
 * stop it when leaving.
 */
function CheckoutScreen() {
  // useFocusEffect(
  //   useCallback(() => {
  //     // Screen focused - start watcher
  //     Missile.register('checkout-watcher', checkoutWatcher);
  //
  //     // Cleanup when screen loses focus
  //     return () => {
  //       Missile.unregister('checkout-watcher');
  //     };
  //   }, [])
  // );

  // Dispatch actions as normal
  const handleApplyCoupon = (code: string) => {
    Missile.dispatch({
      type: 'checkout/APPLY_COUPON',
      payload: { code },
    });
  };

  // return <CheckoutForm onApplyCoupon={handleApplyCoupon} />;
}

// ============================================================================
// Example 2: Feature-Based Watchers
// ============================================================================

/**
 * Premium features watcher - only runs for premium users
 */
function* premiumFeaturesWatcher() {
  yield takeLatest('premium/SYNC_CLOUD', syncToCloudWorker);
  yield takeLatest('premium/GENERATE_REPORT', generateReportWorker);
  yield takeEvery('premium/TRACK_ANALYTICS', advancedAnalyticsWorker);
}

function* syncToCloudWorker(action: Action) {
  // Sync data to cloud
}

function* generateReportWorker(action: Action) {
  // Generate premium report
}

function* advancedAnalyticsWorker(action: Action) {
  // Track advanced analytics
}

/**
 * Watch for premium status changes and enable/disable features
 */
function PremiumFeatureManager() {
  // useWarm({ keys: ['user.isPremium'] }, (event) => {
  //   if (event.newValue === true) {
  //     // User became premium - enable features
  //     if (!Missile.isRegistered('premium-features')) {
  //       Missile.register('premium-features', premiumFeaturesWatcher);
  //       console.log('Premium features enabled');
  //     }
  //   } else {
  //     // User is not premium - disable features
  //     if (Missile.isRegistered('premium-features')) {
  //       Missile.unregister('premium-features');
  //       console.log('Premium features disabled');
  //     }
  //   }
  // });

  return null;
}

// ============================================================================
// Example 3: Conditional Watchers Based on Network
// ============================================================================

/**
 * Background sync watcher - only runs when online
 */
function* backgroundSyncWatcher() {
  while (true) {
    yield call(syncPendingChanges);
    yield delay(30000); // Sync every 30 seconds
  }
}

function* syncPendingChanges() {
  // Sync any pending local changes to server
  const pendingChanges = yield call(Air.getWarm, 'sync.pending');
  if (pendingChanges) {
    // ... sync logic
  }
}

/**
 * Start/stop sync based on network status
 */
function NetworkAwareSyncManager() {
  // useWarm({ keys: ['network.isOnline'] }, (event) => {
  //   const isOnline = event.newValue as boolean;
  //
  //   if (isOnline) {
  //     // Back online - start syncing
  //     if (!Missile.isRegistered('background-sync')) {
  //       Missile.register('background-sync', backgroundSyncWatcher);
  //
  //       // Immediately sync any changes made while offline
  //       Missile.dispatch({ type: 'sync/FLUSH_PENDING' });
  //     }
  //   } else {
  //     // Went offline - stop syncing
  //     Missile.unregister('background-sync');
  //   }
  // });

  return null;
}

// ============================================================================
// Example 4: Multi-Tenant Watchers
// ============================================================================

/**
 * Workspace-specific watcher
 * Different workspaces might have different capabilities
 */
function* workspaceWatcher(workspaceId: string) {
  // This watcher is parameterized with the workspace ID
  yield takeLatest('workspace/FETCH_DATA', function* (action: Action) {
    yield call(fetchWorkspaceData, workspaceId);
  });

  yield takeLatest('workspace/UPDATE_SETTINGS', function* (action: Action) {
    yield call(updateWorkspaceSettings, workspaceId, action.payload);
  });
}

function* fetchWorkspaceData(workspaceId: string) {
  // Fetch data for specific workspace
}

function* updateWorkspaceSettings(workspaceId: string, settings: any) {
  // Update workspace settings
}

/**
 * Switch watchers when user changes workspace
 */
function WorkspaceManager() {
  // useWarm({ keys: ['workspace.currentId'] }, (event) => {
  //   const newWorkspaceId = event.newValue as string;
  //   const oldWorkspaceId = event.oldValue as string;
  //
  //   if (newWorkspaceId !== oldWorkspaceId) {
  //     // Stop old workspace watcher
  //     if (oldWorkspaceId) {
  //       Missile.unregister(`workspace-${oldWorkspaceId}`);
  //     }
  //
  //     // Start new workspace watcher
  //     if (newWorkspaceId) {
  //       Missile.register(
  //         `workspace-${newWorkspaceId}`,
  //         workspaceWatcher,
  //         newWorkspaceId // Pass workspace ID as argument
  //       );
  //     }
  //   }
  // });

  return null;
}

// ============================================================================
// Example 5: Debug/Development Watchers
// ============================================================================

/**
 * Development-only watcher for debugging
 */
function* devToolsWatcher() {
  // Log all actions
  yield takeEvery('*', function* (action: Action) {
    console.log(`[Action] ${action.type}`, action.payload);
  });
}

/**
 * Enable dev tools in development
 */
function initializeDevTools() {
  if (__DEV__) {
    Missile.register('dev-tools', devToolsWatcher);

    // Also subscribe to all actions for a simpler log
    Missile.subscribe((action) => {
      console.log(`[Dispatch] ${action.type}`);
    });
  }
}

// ============================================================================
// Example 6: Listing and Managing All Watchers
// ============================================================================

/**
 * Admin panel to view and manage watchers
 */
function WatcherAdminPanel() {
  // const [watchers, setWatchers] = useState<string[]>([]);
  //
  // useEffect(() => {
  //   // Get initial list
  //   setWatchers(Missile.getRegisteredNames());
  //
  //   // Poll for updates (in real app, use a better approach)
  //   const interval = setInterval(() => {
  //     setWatchers(Missile.getRegisteredNames());
  //   }, 1000);
  //
  //   return () => clearInterval(interval);
  // }, []);
  //
  // const handleStopWatcher = (name: string) => {
  //   Missile.unregister(name);
  // };
  //
  // const handleStopAll = () => {
  //   Missile.unregisterAll();
  // };
  //
  // return (
  //   <View>
  //     <Text>Running Watchers: {watchers.length}</Text>
  //     {watchers.map((name) => (
  //       <View key={name}>
  //         <Text>{name}</Text>
  //         <Button title="Stop" onPress={() => handleStopWatcher(name)} />
  //       </View>
  //     ))}
  //     <Button title="Stop All" onPress={handleStopAll} />
  //   </View>
  // );
}

// ============================================================================
// Cleanup on App Shutdown
// ============================================================================

/**
 * Clean up when app is closing
 */
function handleAppShutdown() {
  // Stop all named sagas
  Missile.unregisterAll();

  // Stop ALL tasks (including anonymous ones)
  Missile.cancelAllTasks();
}

// ============================================================================
// Key Takeaways
// ============================================================================

/**
 * 1. Use Missile.register(name, saga) to start a named saga
 * 2. Use Missile.unregister(name) to stop it
 * 3. Use Missile.isRegistered(name) to check if running
 * 4. Use Missile.getRegisteredNames() to list all registered sagas
 * 5. Use Missile.unregisterAll() for cleanup (logout, shutdown)
 *
 * Common patterns:
 * - Screen-based: Start on focus, stop on blur
 * - Feature-based: Enable/disable based on user tier
 * - Network-aware: Start/stop based on connectivity
 * - Multi-tenant: Switch watchers when context changes
 * - Development: Dev-only debugging watchers
 */

export {
  checkoutWatcher,
  premiumFeaturesWatcher,
  backgroundSyncWatcher,
  workspaceWatcher,
};
