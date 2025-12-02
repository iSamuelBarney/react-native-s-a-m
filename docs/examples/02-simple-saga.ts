/**
 * Example 02: Simple Saga (Watcher + Worker Pattern)
 *
 * This example shows the fundamental saga pattern:
 * - WATCHER: Listens for actions and delegates to workers
 * - WORKER: Contains the actual business logic
 */

import { Missile, Air } from 'react-native-s-a-m';

// Destructure effects for cleaner code
const { call, put, takeLatest, takeEvery } = Missile;

// ============================================================================
// Action Types
// ============================================================================

const UserActions = {
  FETCH: 'user/FETCH',
  FETCH_SUCCESS: 'user/FETCH_SUCCESS',
  FETCH_FAILURE: 'user/FETCH_FAILURE',
  UPDATE_PROFILE: 'user/UPDATE_PROFILE',
  UPDATE_SUCCESS: 'user/UPDATE_SUCCESS',
  UPDATE_FAILURE: 'user/UPDATE_FAILURE',
} as const;

// ============================================================================
// Mock API (replace with your actual API)
// ============================================================================

const userApi = {
  async getUser(userId: string) {
    const response = await fetch(`/api/users/${userId}`);
    if (!response.ok) throw new Error('Failed to fetch user');
    return response.json();
  },

  async updateProfile(userId: string, data: any) {
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update profile');
    return response.json();
  },
};

// ============================================================================
// Worker Sagas (Business Logic)
// ============================================================================

/**
 * Worker: Fetches a user from the API and stores in Air.
 *
 * Workers receive the triggering action as their first argument.
 * They contain the actual business logic - API calls, storage updates, etc.
 */
function* fetchUserWorker(action: { type: string; payload: { userId: string } }) {
  const { userId } = action.payload;

  try {
    // Set loading state
    yield call(Air.setWarm, 'user.loading', true);
    yield call(Air.setWarm, 'user.error', null);

    // Call API
    const user = yield call(userApi.getUser, userId);

    // Store user in Air (Warm storage)
    yield call(Air.setWarm, 'user.data', JSON.stringify(user));
    yield call(Air.setWarm, 'user.id', userId);

    // Dispatch success action (other sagas can listen to this)
    yield put({
      type: UserActions.FETCH_SUCCESS,
      payload: user,
    });
  } catch (error: any) {
    // Store error
    yield call(Air.setWarm, 'user.error', error.message);

    // Dispatch failure action
    yield put({
      type: UserActions.FETCH_FAILURE,
      payload: error.message,
    });
  } finally {
    // Always clear loading state
    yield call(Air.setWarm, 'user.loading', false);
  }
}

/**
 * Worker: Updates user profile.
 */
function* updateProfileWorker(action: {
  type: string;
  payload: { userId: string; data: any };
}) {
  const { userId, data } = action.payload;

  try {
    yield call(Air.setWarm, 'user.updating', true);

    // Call API
    const updatedUser = yield call(userApi.updateProfile, userId, data);

    // Update stored user
    yield call(Air.setWarm, 'user.data', JSON.stringify(updatedUser));

    yield put({
      type: UserActions.UPDATE_SUCCESS,
      payload: updatedUser,
    });
  } catch (error: any) {
    yield put({
      type: UserActions.UPDATE_FAILURE,
      payload: error.message,
    });
  } finally {
    yield call(Air.setWarm, 'user.updating', false);
  }
}

// ============================================================================
// Watcher Saga
// ============================================================================

/**
 * Watcher: Listens for user-related actions and delegates to workers.
 *
 * Watchers use effects like takeLatest, takeEvery to route actions.
 * They run forever (while true loop is implicit in takeLatest/takeEvery).
 */
export function* userWatcher() {
  // takeLatest: Cancel previous fetch if a new one is requested
  // This is good for things like search or data fetching
  yield takeLatest(UserActions.FETCH, fetchUserWorker);

  // takeEvery: Handle every update, don't cancel previous
  // This is good for things that should always complete
  yield takeEvery(UserActions.UPDATE_PROFILE, updateProfileWorker);
}

// ============================================================================
// Alternative: Explicit Watcher Pattern
// ============================================================================

/**
 * Sometimes you need more control than takeLatest/takeEvery provide.
 * You can write an explicit watcher loop.
 */
// function* explicitUserWatcher() {
//   while (true) {
//     // Wait for either action
//     const action = yield take([UserActions.FETCH, UserActions.UPDATE_PROFILE]);
//
//     if (action.type === UserActions.FETCH) {
//       // Fork so we don't block the watcher
//       yield fork(fetchUserWorker, action);
//     } else if (action.type === UserActions.UPDATE_PROFILE) {
//       yield fork(updateProfileWorker, action);
//     }
//   }
// }

// ============================================================================
// Registering the Saga
// ============================================================================

/**
 * Register the watcher at app startup (usually in App.tsx or index.js).
 */
function initializeSagas() {
  // Option 1: Anonymous saga (can cancel via returned task)
  const task = Missile.runSaga(userWatcher);

  // Option 2: Named saga (can start/stop by name)
  Missile.register('user-watcher', userWatcher);
}

// ============================================================================
// Using from a Component
// ============================================================================

/**
 * Components just dispatch actions - they don't know about sagas.
 * The saga handles all the complexity.
 */
function UserProfileScreen({ userId }: { userId: string }) {
  // Fetch user on mount
  // useEffect(() => {
  //   Missile.dispatch({
  //     type: UserActions.FETCH,
  //     payload: { userId },
  //   });
  // }, [userId]);

  const handleUpdateName = (newName: string) => {
    Missile.dispatch({
      type: UserActions.UPDATE_PROFILE,
      payload: {
        userId,
        data: { name: newName },
      },
    });
  };

  // Component renders based on Air storage (use useWarm hook)
  // The saga updates Air, which triggers re-renders
}

// ============================================================================
// Key Takeaways
// ============================================================================

/**
 * 1. WATCHER saga listens for actions using takeLatest/takeEvery
 * 2. WORKER saga contains the business logic
 * 3. Workers receive the action as their first argument
 * 4. Use `call` for API calls and storage operations
 * 5. Use `put` to dispatch result actions
 * 6. Use try/catch/finally for error handling and cleanup
 * 7. Store state in Air - components watch Air, not saga state
 * 8. Register watchers at app startup with runSaga or register
 */

export { UserActions, fetchUserWorker, updateProfileWorker };
