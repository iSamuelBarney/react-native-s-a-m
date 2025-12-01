# S.A.M React Hooks

React hooks for declarative storage watching with automatic cleanup.

## Table of Contents

- [useWarm](#usewarm)
- [useCold](#usecold)
- [useStorage](#usestorage)
- [useSecure](#usesecure)
- [useSecureCredentials](#usesecurecredentials)
- [useMFEState](#usemfestate)
- [useMFEStates](#usemfestates)
- [useMFEControl](#usemfecontrol)
- [Common Patterns](#common-patterns)
- [Best Practices](#best-practices)

---

## useWarm

React hook for watching MMKV (warm storage) changes.

### Signature

```typescript
function useWarm<T = unknown>(
  config: UseWarmConfig,
  callback?: (event: WarmChangeEvent) => void
): UseWarmResult<T>
```

### Configuration

```typescript
interface UseWarmConfig {
  id?: string;              // MMKV instance ID (default: "default")
  keys: string[];           // Array of keys to watch
  patterns?: string[];      // Glob patterns for key matching
  conditions?: Condition[]; // Conditional triggers
  store?: {
    path?: string;          // Custom storage path
    encryptionKey?: string; // Encryption key
  };
  options?: {
    debounceMs?: number;     // Debounce delay
    throttleMs?: number;     // Throttle interval
    fireImmediately?: boolean; // Fire on mount (default: true)
    debug?: boolean;         // Enable debug logging
  };
}
```

### Return Value

```typescript
interface UseWarmResult<T> {
  get: (key: string) => T | undefined;           // Query specific key
  getAll: () => Record<string, T | undefined>;   // Query all watched keys
  isListening: boolean;                          // Listener status
  listenerId: string;                            // Internal listener ID
  pause: () => void;                             // Pause listening
  resume: () => void;                            // Resume listening
  refresh: () => void;                           // Force refresh
}
```

### Callback Event

```typescript
interface WarmChangeEvent {
  listenerId: string;
  source: 'warm';
  key: string;
  operation: 'set' | 'delete';
  oldValue?: unknown;
  newValue?: unknown;
  timestamp: number;
}
```

### Examples

#### Basic Usage

```typescript
function UserGreeting() {
  const { isListening } = useWarm({
    keys: ['user.name']
  });

  const name = SideFx.getMMKV('user.name');

  return (
    <View>
      <Text>Hello, {name ?? 'Guest'}!</Text>
      <Text>{isListening ? 'Watching' : 'Not watching'}</Text>
    </View>
  );
}
```

#### With Callback

```typescript
function AuthWatcher() {
  const { isListening } = useWarm(
    {
      keys: ['auth.token', 'auth.refreshToken']
    },
    (event) => {
      if (event.operation === 'delete' && event.key === 'auth.token') {
        // Token was deleted, redirect to login
        navigation.navigate('Login');
      }
    }
  );

  return null; // This component just watches
}
```

#### With Patterns

```typescript
function SettingsWatcher() {
  useWarm(
    {
      keys: [],
      patterns: ['settings.*', 'preferences.*']
    },
    (event) => {
      console.log(`Setting changed: ${event.key} = ${event.newValue}`);
    }
  );
}
```

#### With Conditions

```typescript
function CartNotifier() {
  useWarm(
    {
      keys: ['cart.total'],
      conditions: [
        { type: 'greaterThan', value: 100 }
      ]
    },
    (event) => {
      // Only fires when cart total exceeds $100
      showFreeShippingBanner();
    }
  );
}
```

#### With Debounce

```typescript
function SearchComponent() {
  const [query, setQuery] = useState('');

  useWarm(
    {
      keys: ['search.query'],
      options: {
        debounceMs: 300  // Wait 300ms after last change
      }
    },
    (event) => {
      // Only fires after user stops typing for 300ms
      performSearch(event.newValue as string);
    }
  );

  return (
    <TextInput
      value={query}
      onChangeText={(text) => {
        setQuery(text);
        SideFx.setMMKV('search.query', text);
      }}
    />
  );
}
```

---

## useCold

React hook for watching Cold storage changes.

### Signature

```typescript
function useCold<T = unknown>(
  config: UseColdConfig,
  callback?: (event: ColdChangeEvent) => void
): UseColdResult<T>
```

### Configuration

```typescript
interface UseColdConfig {
  database?: string;              // Database name (default: "default")
  table?: string;                 // Table to watch
  columns?: string[];             // Specific columns to watch
  operations?: ColdOperation[];   // Operations to watch
  where?: RowCondition[];         // Row-level conditions
  query?: string;                 // Watch query results instead
  queryParams?: Array<string | number | boolean | null>;
  connection?: {
    path?: string;
    type?: 'sqlite' | 'realm' | 'auto';
  };
  options?: {
    debounceMs?: number;
    throttleMs?: number;
    fireImmediately?: boolean;
    debug?: boolean;
  };
}
```

### Return Value

```typescript
interface UseColdResult<T> {
  query: () => T | null;                           // Query data
  queryWith: (params?: Array<...>) => T | null;    // Query with custom params
  isListening: boolean;
  listenerId: string;
  lastChange: {
    operation: ColdOperation | null;
    rowId: number | null;
    timestamp: number | null;
  };
  pause: () => void;
  resume: () => void;
  refresh: () => void;
}
```

### Callback Event

```typescript
interface ColdChangeEvent {
  listenerId: string;
  source: 'cold';
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  rowId: number;
  row?: RowData;
  previousRow?: RowData;
  timestamp: number;
  queryResult?: unknown;
}
```

### Examples

#### Basic Table Watching

```typescript
function UsersList() {
  const { lastChange, refresh } = useCold({
    database: 'app-db',
    table: 'users',
    operations: ['INSERT', 'UPDATE', 'DELETE']
  });

  const users = Air.queryCold<User[]>('SELECT * FROM users');

  return (
    <FlatList
      data={users}
      renderItem={({ item }) => <UserRow user={item} />}
      ListHeaderComponent={
        <Text>Last change: {lastChange.operation}</Text>
      }
    />
  );
}
```

#### Watch Specific Columns

```typescript
function OrderStatusWatcher() {
  useCold(
    {
      table: 'orders',
      columns: ['status'],  // Only watch status changes
      operations: ['UPDATE']
    },
    (event) => {
      // Only fires when order status changes
      showNotification(`Order ${event.rowId} status updated`);
    }
  );
}
```

#### Watch Insert Operations Only

```typescript
function NewMessageNotifier() {
  useCold(
    {
      table: 'messages',
      operations: ['INSERT']  // Only new messages
    },
    (event) => {
      playNotificationSound();
      showNewMessageBadge();
    }
  );
}
```

#### Watch with Row Conditions

```typescript
function HighValueOrderWatcher() {
  useCold(
    {
      table: 'orders',
      operations: ['INSERT'],
      where: [
        {
          column: 'total',
          condition: { type: 'greaterThan', value: 1000 }
        }
      ]
    },
    (event) => {
      // Only fires for orders over $1000
      alertSalesTeam(event.rowId);
    }
  );
}
```

---

## useStorage

React hook for watching both Warm and Cold storage with correlation support.

### Signature

```typescript
function useStorage<TWarm = unknown, TCold = unknown>(
  config: UseStorageConfig,
  callback?: (event: ChangeEvent) => void
): UseStorageResult<TWarm, TCold>
```

### Configuration

```typescript
interface UseStorageConfig {
  warm?: {
    id?: string;
    keys: string[];
    patterns?: string[];
    conditions?: Condition[];
  };
  cold?: {
    database?: string;
    table?: string;
    query?: string;
    queryParams?: Array<string | number | boolean | null>;
    columns?: string[];
    operations?: ColdOperation[];
  };
  logic?: 'AND' | 'OR';  // How to combine triggers (default: 'OR')
  correlation?: {
    warmKey: string;     // Warm key to use as Cold storage param
    coldParam: string;   // Cold storage parameter name
  };
  options?: {
    debounceMs?: number;
    throttleMs?: number;
    fireImmediately?: boolean;
    debug?: boolean;
  };
}
```

### Return Value

```typescript
interface UseStorageResult<TWarm, TCold> {
  getWarm: (key: string) => TWarm | undefined;
  queryCold: () => TCold | null;
  lastSource: 'warm' | 'cold' | null;
  isListening: boolean;
  listenerId: string;
  pause: () => void;
  resume: () => void;
  refresh: () => void;
}
```

### Examples

#### Watch Both Storage Types

```typescript
function Dashboard() {
  const { lastSource } = useStorage(
    {
      warm: { keys: ['user.settings'] },
      cold: { table: 'analytics' },
      logic: 'OR'  // Fire on either change
    },
    (event) => {
      console.log(`Change from ${event.source}`);
    }
  );

  return <Text>Last update from: {lastSource}</Text>;
}
```

#### Correlated Queries

```typescript
function UserOrders() {
  const { isListening } = useStorage<string, Order[]>(
    {
      warm: { keys: ['auth.userId'] },
      cold: {
        query: 'SELECT * FROM orders WHERE user_id = ?',
        queryParams: []
      },
      correlation: {
        warmKey: 'auth.userId',
        coldParam: 'user_id'
      }
    },
    (event) => {
      // Fires when userId changes OR orders table changes
      // The SQLite query automatically uses the current userId
    }
  );

  const userId = Air.getWarm('auth.userId');
  const orders = Air.queryCold<Order[]>(
    'SELECT * FROM orders WHERE user_id = ?',
    [userId]
  );

  return <OrderList orders={orders} />;
}
```

---

## useSecure

React hook for managing secure storage (iOS Keychain / Android Keystore).

### Signature

```typescript
function useSecure(
  config: UseSecureConfig,
  callback?: (event: ChangeEvent) => void
): UseSecureResult
```

### Configuration

```typescript
interface UseSecureConfig {
  service?: string;           // Service namespace (default: 'sam-secure')
  accessible?: SecureAccessible;  // iOS keychain accessibility
  securityLevel?: SecureSecurityLevel;  // Android security level
  requireBiometrics?: boolean;  // Require biometric auth
  autoLoad?: boolean;         // Load credentials on mount (default: true)
  authenticationPrompt?: {    // Biometric prompt customization
    title?: string;
    subtitle?: string;
    description?: string;
    cancel?: string;
  };
}
```

### Return Value

```typescript
interface UseSecureResult {
  key: string | null;           // Stored username/key
  value: string | null;         // Stored password/value
  isLoading: boolean;           // Operation in progress
  error: string | null;         // Error message
  isAvailable: boolean;         // Secure storage available
  biometryType: BiometryType;   // Device biometry type
  set: (key: string, value: string) => Promise<boolean>;
  get: () => Promise<void>;
  has: () => Promise<boolean>;
  delete: () => Promise<boolean>;
  clear: () => void;            // Clear local state only
}
```

### Examples

#### Basic Usage

```typescript
function LoginScreen() {
  const {
    key,
    value,
    isLoading,
    error,
    set,
    delete: remove,
  } = useSecure({
    service: 'auth-credentials',
    autoLoad: true,
  });

  const handleLogin = async (username: string, password: string) => {
    const success = await set(username, password);
    if (success) {
      navigation.navigate('Home');
    }
  };

  const handleLogout = async () => {
    await remove();
    navigation.navigate('Login');
  };

  if (isLoading) return <Spinner />;

  return (
    <View>
      {key ? (
        <Text>Logged in as {key}</Text>
      ) : (
        <LoginForm onSubmit={handleLogin} />
      )}
    </View>
  );
}
```

#### With Biometrics

```typescript
function BiometricLogin() {
  const { key, isLoading, biometryType, set, get } = useSecure({
    service: 'biometric-auth',
    requireBiometrics: true,
    authenticationPrompt: {
      title: 'Authenticate',
      subtitle: 'Use biometrics to access your account',
    },
  });

  return (
    <View>
      {biometryType && (
        <Button
          title={`Login with ${biometryType}`}
          onPress={get}
          disabled={isLoading}
        />
      )}
    </View>
  );
}
```

---

## useSecureCredentials

Simplified hook for watching credential changes.

### Signature

```typescript
function useSecureCredentials(config: UseSecureConfig): {
  credentials: SecureCredentials | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}
```

### Example

```typescript
function AuthProvider({ children }: PropsWithChildren) {
  const { credentials, isLoading, refresh } = useSecureCredentials({
    service: 'auth-service',
  });

  if (isLoading) return <Spinner />;

  return (
    <AuthContext.Provider value={{ credentials, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

## useMFEState

React hook for watching a single micro-frontend's state.

### Signature

```typescript
function useMFEState(mfeId: string): {
  state: MFEState;
  metadata: MFEMetadata | null;
  isLoading: boolean;
  isLoaded: boolean;
  isMounted: boolean;
  isError: boolean;
}
```

### Return Value

| Property | Type | Description |
|----------|------|-------------|
| `state` | `MFEState` | Current state: '' \| 'loading' \| 'loaded' \| 'mounted' \| 'error' |
| `metadata` | `MFEMetadata \| null` | Full metadata including version, timestamps, error message |
| `isLoading` | `boolean` | `state === 'loading'` |
| `isLoaded` | `boolean` | `state === 'loaded'` |
| `isMounted` | `boolean` | `state === 'mounted'` |
| `isError` | `boolean` | `state === 'error'` |

### Example

```typescript
function MFELoader({ mfeId }: { mfeId: string }) {
  const { state, metadata, isLoading, isError, isMounted } = useMFEState(mfeId);

  if (isLoading) {
    return <Spinner />;
  }

  if (isError) {
    return (
      <ErrorView
        message={metadata?.errorMessage ?? 'Failed to load module'}
        onRetry={() => loadMFE(mfeId)}
      />
    );
  }

  if (isMounted) {
    return <Text>MFE is active (v{metadata?.version})</Text>;
  }

  return <Text>State: {state}</Text>;
}
```

---

## useMFEStates

React hook for watching multiple micro-frontends.

### Signature

```typescript
function useMFEStates(mfeIds: string[]): {
  states: Record<string, MFEMetadata | null>;
  getState: (mfeId: string) => MFEState;
  getMetadata: (mfeId: string) => MFEMetadata | null;
  getMounted: () => string[];
  getLoading: () => string[];
  getLoaded: () => string[];
  getErrors: () => string[];
}
```

### Example

```typescript
function MFEDashboard() {
  const {
    states,
    getMounted,
    getLoading,
    getErrors,
    getMetadata,
  } = useMFEStates(['checkout', 'profile', 'cart', 'recommendations']);

  const mountedMFEs = getMounted();
  const loadingMFEs = getLoading();
  const errorMFEs = getErrors();

  return (
    <View>
      <Text>Active Modules: {mountedMFEs.length}</Text>

      {loadingMFEs.length > 0 && (
        <Text>Loading: {loadingMFEs.join(', ')}</Text>
      )}

      {errorMFEs.length > 0 && (
        <View>
          <Text>Errors:</Text>
          {errorMFEs.map(id => (
            <Text key={id}>
              {id}: {getMetadata(id)?.errorMessage}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
```

---

## useMFEControl

React hook for controlling MFE state from within components.

### Signature

```typescript
function useMFEControl(mfeId: string): {
  markLoading: () => void;
  markLoaded: (version?: string) => void;
  markMounted: () => void;
  markUnmounted: (keepLoaded?: boolean) => void;
  markError: (message?: string) => void;
  clear: () => void;
}
```

### Example

```typescript
function MFEContainer({ mfeId, children }: PropsWithChildren<{ mfeId: string }>) {
  const {
    markLoading,
    markLoaded,
    markMounted,
    markUnmounted,
    markError,
  } = useMFEControl(mfeId);

  useEffect(() => {
    markMounted();

    return () => {
      markUnmounted(true);  // Keep as 'loaded' state
    };
  }, [markMounted, markUnmounted]);

  return <View>{children}</View>;
}

// Usage in MFE loader
function loadMFE(mfeId: string) {
  const { markLoading, markLoaded, markError } = useMFEControl(mfeId);

  markLoading();

  try {
    const module = await import(`./mfes/${mfeId}`);
    markLoaded(module.version);
    return module;
  } catch (error) {
    markError(error.message);
    throw error;
  }
}
```

---

## Common Patterns

### Auto-Save Form

```typescript
function AutoSaveForm() {
  const [formData, setFormData] = useState({ name: '', email: '' });

  // Debounce saves to prevent excessive writes
  useWarm(
    {
      keys: ['form.draft'],
      options: { debounceMs: 1000 }
    },
    (event) => {
      // Form was auto-saved
      showSavedIndicator();
    }
  );

  const updateField = (field: string, value: string) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    SideFx.setMMKV('form.draft', JSON.stringify(newData));
  };

  return (
    <View>
      <TextInput
        value={formData.name}
        onChangeText={(v) => updateField('name', v)}
      />
      <TextInput
        value={formData.email}
        onChangeText={(v) => updateField('email', v)}
      />
    </View>
  );
}
```

### Real-Time Sync Indicator

```typescript
function SyncStatus() {
  const [syncCount, setSyncCount] = useState(0);

  useCold(
    {
      table: 'sync_queue',
      operations: ['INSERT', 'DELETE']
    },
    () => {
      const queue = Air.queryCold<{ count: number }[]>(
        'SELECT COUNT(*) as count FROM sync_queue'
      );
      setSyncCount(queue?.[0]?.count ?? 0);
    }
  );

  return (
    <View>
      {syncCount > 0 && (
        <Text>{syncCount} items pending sync</Text>
      )}
    </View>
  );
}
```

### Conditional Feature Flag

```typescript
function PremiumFeature() {
  const [isPremium, setIsPremium] = useState(false);

  useWarm(
    {
      keys: ['user.subscription'],
      conditions: [
        { type: 'equals', value: 'premium' }
      ]
    },
    () => {
      setIsPremium(true);
    }
  );

  if (!isPremium) return null;

  return <PremiumContent />;
}
```

---

## Best Practices

### 1. Clean Up Happens Automatically

Hooks automatically remove listeners on unmount. No manual cleanup needed.

```typescript
// Good - automatic cleanup
function MyComponent() {
  useWarm({ keys: ['data'] });
  return <View />;
}
```

### 2. Use Specific Keys Over Patterns

Patterns are powerful but less efficient. Use exact keys when possible.

```typescript
// Better - specific keys
useWarm({ keys: ['user.name', 'user.email'] });

// Avoid when not needed
useWarm({ patterns: ['user.*'] });
```

### 3. Use Conditions to Reduce Callbacks

Instead of filtering in callbacks, use conditions.

```typescript
// Better - native filtering
useWarm({
  keys: ['cart.total'],
  conditions: [{ type: 'greaterThan', value: 100 }]
});

// Avoid - JS filtering
useWarm({ keys: ['cart.total'] }, (event) => {
  if (event.newValue > 100) { /* ... */ }
});
```

### 4. Debounce Rapid Changes

For user input or frequent updates, use debounce.

```typescript
useWarm({
  keys: ['search.query'],
  options: { debounceMs: 300 }
});
```

### 5. Use TypeScript Generics

Specify types for better type safety.

```typescript
interface User {
  id: number;
  name: string;
}

const users = Air.queryCold<User[]>('SELECT * FROM users');
```
