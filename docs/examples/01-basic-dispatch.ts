/**
 * Example 01: Basic Action Dispatch
 *
 * This example demonstrates the simplest use of Missile - dispatching actions
 * from anywhere in your application. No hooks, no providers, just call dispatch().
 */

import { Missile } from 'react-native-s-a-m';

// ============================================================================
// Action Types (optional but recommended for consistency)
// ============================================================================

export const AuthActions = {
  LOGIN: 'auth/LOGIN',
  LOGIN_SUCCESS: 'auth/LOGIN_SUCCESS',
  LOGIN_FAILURE: 'auth/LOGIN_FAILURE',
  LOGOUT: 'auth/LOGOUT',
} as const;

export const CartActions = {
  ADD_ITEM: 'cart/ADD_ITEM',
  REMOVE_ITEM: 'cart/REMOVE_ITEM',
  CLEAR: 'cart/CLEAR',
} as const;

// ============================================================================
// Dispatching from a React Component
// ============================================================================

/**
 * You can dispatch actions directly from event handlers.
 * No useDispatch hook needed!
 */
function LoginButton() {
  const handleLogin = () => {
    // Simple dispatch with type and payload
    Missile.dispatch({
      type: AuthActions.LOGIN,
      payload: {
        email: 'user@example.com',
        password: 'secret123',
      },
    });
  };

  // return <Button onPress={handleLogin} title="Login" />;
}

/**
 * You can also use the optional `status` field to track action lifecycle.
 */
function CheckoutButton({ cartId }: { cartId: string }) {
  const handleCheckout = () => {
    Missile.dispatch({
      type: 'checkout/START',
      payload: { cartId },
      status: 'pending', // Useful for showing loading states
    });
  };

  // return <Button onPress={handleCheckout} title="Checkout" />;
}

// ============================================================================
// Dispatching from Utility Functions (Outside React)
// ============================================================================

/**
 * dispatch() works anywhere - not just in components!
 * This is useful for API interceptors, navigation handlers, etc.
 */

// Example: API Error Interceptor
const apiClient = {
  interceptors: {
    response: {
      use: (onSuccess: any, onError: any) => {
        // This would be your actual axios/fetch interceptor
      },
    },
  },
};

// Handle 401 errors globally
apiClient.interceptors.response.use(
  (response: any) => response,
  (error: any) => {
    if (error.response?.status === 401) {
      // Dispatch logout action from interceptor
      Missile.dispatch({ type: AuthActions.LOGOUT });
    }
    return Promise.reject(error);
  }
);

// Example: Navigation Event Handler
function setupNavigationListeners(navigation: any) {
  navigation.addListener('beforeRemove', (e: any) => {
    // Track screen exits for analytics
    Missile.dispatch({
      type: 'analytics/SCREEN_EXIT',
      payload: { screen: e.target },
    });
  });
}

// Example: WebSocket Message Handler
function handleWebSocketMessage(message: any) {
  switch (message.type) {
    case 'NEW_NOTIFICATION':
      Missile.dispatch({
        type: 'notifications/RECEIVED',
        payload: message.data,
      });
      break;

    case 'CART_UPDATED':
      Missile.dispatch({
        type: 'cart/SYNC_FROM_SERVER',
        payload: message.data,
      });
      break;
  }
}

// Example: Push Notification Handler
function handlePushNotification(notification: any) {
  Missile.dispatch({
    type: 'push/RECEIVED',
    payload: {
      id: notification.id,
      title: notification.title,
      data: notification.data,
    },
  });
}

// ============================================================================
// Type-Safe Dispatch Helper (Optional)
// ============================================================================

/**
 * For better TypeScript support, you can create a typed dispatch wrapper.
 * This gives you autocomplete for action types and type-checks payloads.
 */

type ActionPayloads = {
  'auth/LOGIN': { email: string; password: string };
  'auth/LOGOUT': undefined;
  'cart/ADD_ITEM': { productId: string; quantity: number };
  'cart/REMOVE_ITEM': { productId: string };
  'cart/CLEAR': undefined;
};

type ActionType = keyof ActionPayloads;

function typedDispatch<T extends ActionType>(
  type: T,
  payload?: ActionPayloads[T],
  status?: 'pending' | 'success' | 'error'
) {
  Missile.dispatch({ type, payload, status });
}

// Usage with full type safety:
// typedDispatch('auth/LOGIN', { email: 'test@test.com', password: '123' }); // OK
// typedDispatch('auth/LOGIN', { wrong: 'field' }); // Type error!
// typedDispatch('cart/ADD_ITEM', { productId: 'abc', quantity: 2 }); // OK

// ============================================================================
// Key Takeaways
// ============================================================================

/**
 * 1. Missile.dispatch() works ANYWHERE - components, utilities, interceptors
 * 2. No hooks or providers required
 * 3. Actions have: type (required), payload (optional), status (optional)
 * 4. Use action type constants for consistency
 * 5. Create typed wrappers for better TypeScript support
 */

export { typedDispatch };
