# S.A.M API Reference

Complete API reference for the SideFx low-level API.

## Table of Contents

- [Initialization](#initialization)
- [Listener Management](#listener-management)
- [MMKV Storage](#mmkv-storage)
- [Cold Storage](#cold-storage)
- [Secure Storage](#secure-storage)
- [MFE State Tracking](#mfe-state-tracking)
- [Configuration](#configuration)
- [Types](#types)

---

## Initialization

### getDefaultMMKVPath

Get the platform-specific default MMKV storage path.

```typescript
SideFx.getDefaultMMKVPath(): string
```

**Returns:**
- **iOS:** `Library/mmkv` (auto-detected)
- **Android:** Empty string if not set (must call `setMMKVRootPath` first)

**Example:**
```typescript
const defaultPath = SideFx.getDefaultMMKVPath();
console.log('MMKV path:', defaultPath);
// iOS: /var/mobile/.../Library/mmkv
// Android: '' (empty until set)
```

---

### setMMKVRootPath

Set the root directory for MMKV storage files.

```typescript
SideFx.setMMKVRootPath(rootPath: string): void
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `rootPath` | `string` | Directory path for MMKV storage files |

**Platform Notes:**
- **iOS:** Optional - path is auto-detected as `Library/mmkv`
- **Android:** Required - must be set before calling `initializeMMKV`

**Example:**
```typescript
import { Platform } from 'react-native';

// Only required on Android
if (Platform.OS === 'android') {
  // Use your app's files directory
  SideFx.setMMKVRootPath('/data/data/com.yourapp/files/mmkv');
}
```

---

### initializeMMKV

Initialize MMKV storage adapter. Must be called before MMKV listeners will work.

```typescript
SideFx.initializeMMKV(instanceId?: string): ListenerResult
```

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `instanceId` | `string` | `"default"` | MMKV instance identifier |

**Returns:** `ListenerResult`

**Platform Notes:**
- **iOS:** Auto-initializes with `Library/mmkv` path
- **Android:** Requires `setMMKVRootPath` to be called first

**Example:**
```typescript
import { Platform } from 'react-native';

// Android setup
if (Platform.OS === 'android') {
  SideFx.setMMKVRootPath('/data/data/com.yourapp/files/mmkv');
}

// Initialize instances (works on both platforms after setup)
SideFx.initializeMMKV();                    // 'default' instance
SideFx.initializeMMKV('user-data');         // Named instance
SideFx.initializeMMKV('sam-mfe-registry');  // MFE tracking instance
```

---

### initializeCold

Initialize Cold storage adapter. Must be called before Cold storage listeners will work.

```typescript
Air.initializeCold(databaseName: string, databasePath: string): ListenerResult
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `databaseName` | `string` | Unique name for this database |
| `databasePath` | `string` | File system path to the database |

**Returns:** `ListenerResult`

**Example:**
```typescript
Air.initializeCold('app-db', '/data/app.db');
Air.initializeCold('cache-db', '/tmp/cache.db');
```

---

### isMMKVInitialized

Check if MMKV adapter is initialized.

```typescript
SideFx.isMMKVInitialized(instanceId?: string): boolean
```

---

### isColdInitialized

Check if Cold storage adapter is initialized.

```typescript
Air.isColdInitialized(databaseName?: string): boolean
```

---

## Listener Management

### addListener

Add a new listener for storage changes.

```typescript
SideFx.addListener(
  id: string,
  config: ListenerConfig,
  callback: ListenerCallback
): ListenerResult
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `id` | `string` | Unique identifier for this listener |
| `config` | `ListenerConfig` | Configuration specifying what to watch |
| `callback` | `ListenerCallback` | Function called when changes occur |

**Returns:** `ListenerResult`

**Example:**
```typescript
SideFx.addListener(
  'user-name-watcher',
  {
    mmkv: {
      keys: ['user.name', 'user.email'],
      instanceId: 'default'
    },
    options: {
      fireImmediately: true,
      debounceMs: 300
    }
  },
  (event) => {
    console.log(`${event.key} changed to ${event.newValue}`);
  }
);
```

---

### removeListener

Remove a listener by ID.

```typescript
SideFx.removeListener(id: string): ListenerResult
```

**Example:**
```typescript
SideFx.removeListener('user-name-watcher');
```

---

### removeAllListeners

Remove all listeners.

```typescript
SideFx.removeAllListeners(): number
```

**Returns:** Number of listeners removed

---

### hasListener

Check if a listener exists.

```typescript
SideFx.hasListener(id: string): boolean
```

---

### getListeners

Get detailed info about all listeners.

```typescript
SideFx.getListeners(): ListenerInfo[]
```

**Returns:** Array of `ListenerInfo` objects

**Example:**
```typescript
const listeners = SideFx.getListeners();
listeners.forEach(listener => {
  console.log(`${listener.id}: ${listener.triggerCount} triggers`);
});
```

---

### getListener

Get info about a specific listener.

```typescript
SideFx.getListener(id: string): ListenerInfo | undefined
```

---

### getListenerIds

Get all active listener IDs.

```typescript
SideFx.getListenerIds(): string[]
```

---

### pauseListener

Temporarily pause a listener.

```typescript
SideFx.pauseListener(id: string): ListenerResult
```

---

### resumeListener

Resume a paused listener.

```typescript
SideFx.resumeListener(id: string): ListenerResult
```

---

## MMKV Storage

### setMMKV

Set a value in MMKV storage.

```typescript
SideFx.setMMKV(
  key: string,
  value: string | number | boolean,
  instanceId?: string
): ListenerResult
```

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `key` | `string` | - | The key to set |
| `value` | `string \| number \| boolean` | - | The value to set |
| `instanceId` | `string` | `"default"` | MMKV instance ID |

**Example:**
```typescript
// Set in default instance
SideFx.setMMKV('user.name', 'John');
SideFx.setMMKV('user.age', 30);
SideFx.setMMKV('user.premium', true);

// Set in specific instance
SideFx.setMMKV('api.token', 'abc123', 'secure-store');
```

---

### getMMKV

Get a value from MMKV storage.

```typescript
SideFx.getMMKV(key: string, instanceId?: string): string | number | boolean | null
```

**Returns:** The value or `null` if not found

**Example:**
```typescript
const name = SideFx.getMMKV('user.name');
const token = SideFx.getMMKV('api.token', 'secure-store');
```

---

### deleteMMKV

Delete a key from MMKV storage.

```typescript
SideFx.deleteMMKV(key: string, instanceId?: string): ListenerResult
```

---

## Cold Storage

### executeCold

Execute a SQL statement (INSERT, UPDATE, DELETE, CREATE, etc.).

```typescript
Air.executeCold(
  sql: string,
  params?: Array<string | number | boolean | null>,
  databaseName?: string
): ListenerResult
```

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `sql` | `string` | - | SQL statement to execute |
| `params` | `Array` | `undefined` | Parameterized values |
| `databaseName` | `string` | `"default"` | Database name |

**Example:**
```typescript
// Create table
Air.executeCold(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Insert with parameters
Air.executeCold(
  'INSERT INTO users (name, email) VALUES (?, ?)',
  ['John Doe', 'john@example.com']
);

// Update
Air.executeCold(
  'UPDATE users SET name = ? WHERE id = ?',
  ['Jane Doe', 1]
);

// Delete
Air.executeCold(
  'DELETE FROM users WHERE id = ?',
  [1]
);
```

---

### queryCold

Query Cold storage and return results.

```typescript
Air.queryCold<T = unknown>(
  sql: string,
  params?: Array<string | number | boolean | null>,
  databaseName?: string
): T | null
```

**Returns:** Query results as typed array, or `null` on error

**Example:**
```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

// Query all users
const users = Air.queryCold<User[]>('SELECT * FROM users');

// Query with parameters
const user = Air.queryCold<User[]>(
  'SELECT * FROM users WHERE id = ?',
  [1]
);

// Query with multiple conditions
const activeUsers = Air.queryCold<User[]>(
  'SELECT * FROM users WHERE active = ? AND role = ?',
  [true, 'admin']
);
```

---

## Secure Storage

Secure storage API for iOS Keychain and Android Keystore. Requires optional `react-native-keychain` peer dependency.

### isAvailable

Check if secure storage is available on the device.

```typescript
SecureStorage.isAvailable(): boolean
```

---

### getSupportedBiometryType

Get the device's supported biometry type.

```typescript
SecureStorage.getSupportedBiometryType(): Promise<BiometryType>
```

**Returns:** `'TouchID' | 'FaceID' | 'Fingerprint' | 'Face' | 'Iris' | null`

---

### set

Store credentials securely.

```typescript
SecureStorage.set(
  key: string,
  value: string,
  options?: SecureStorageOptions
): Promise<SecureResult>
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `key` | `string` | Username or key identifier |
| `value` | `string` | Password or secret value |
| `options` | `SecureStorageOptions` | Storage options |

**Example:**
```typescript
await SecureStorage.set('admin', 'super-secret-password', {
  service: 'my-app-auth',
  accessible: 'AfterFirstUnlock',
  requireBiometrics: true,
  authenticationPrompt: {
    title: 'Authenticate',
    subtitle: 'Confirm your identity',
  },
});
```

---

### get

Retrieve stored credentials.

```typescript
SecureStorage.get(options?: SecureStorageOptions): Promise<SecureCredentials | null>
```

**Returns:** `{ username: string, password: string, service: string }` or `null`

**Example:**
```typescript
const credentials = await SecureStorage.get({ service: 'my-app-auth' });
if (credentials) {
  console.log(credentials.username, credentials.password);
}
```

---

### has

Check if credentials exist.

```typescript
SecureStorage.has(options?: SecureStorageOptions): Promise<boolean>
```

---

### delete

Delete stored credentials.

```typescript
SecureStorage.delete(options?: SecureStorageOptions): Promise<SecureResult>
```

---

### getAllServices

Get all stored service names.

```typescript
SecureStorage.getAllServices(): Promise<string[]>
```

---

### setInternetCredentials

Store server-specific credentials.

```typescript
SecureStorage.setInternetCredentials(
  server: string,
  username: string,
  password: string,
  options?: SecureStorageOptions
): Promise<SecureResult>
```

---

### getInternetCredentials

Retrieve server-specific credentials.

```typescript
SecureStorage.getInternetCredentials(
  server: string,
  options?: SecureStorageOptions
): Promise<SecureCredentials | null>
```

---

### deleteInternetCredentials

Delete server-specific credentials.

```typescript
SecureStorage.deleteInternetCredentials(
  server: string,
  options?: SecureStorageOptions
): Promise<SecureResult>
```

---

## MFE State Tracking

Track micro-frontend loading states and lifecycle through MMKV storage.

### setMMKVRootPath (MFE)

Set MMKV root path for MFE tracking. Wrapper around `SideFx.setMMKVRootPath`.

```typescript
setMMKVRootPath(rootPath: string): void
```

**Example:**
```typescript
import { Platform } from 'react-native';
import { setMMKVRootPath } from 'react-native-s-a-m';

if (Platform.OS === 'android') {
  setMMKVRootPath('/data/data/com.yourapp/files/mmkv');
}
```

---

### initializeMFERegistry

Initialize the MFE registry. Call once at app start.

```typescript
initializeMFERegistry(mmkvRootPath?: string): void
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `mmkvRootPath` | `string` | Optional. MMKV root path (required on Android if not set via `setMMKVRootPath`) |

**Example:**
```typescript
import { Platform } from 'react-native';
import { initializeMFERegistry } from 'react-native-s-a-m';

// Option 1: Pass path directly (Android)
if (Platform.OS === 'android') {
  initializeMFERegistry('/data/data/com.yourapp/files/mmkv');
} else {
  initializeMFERegistry();  // iOS auto-detects path
}

// Option 2: Set path separately, then initialize
setMMKVRootPath('/data/data/com.yourapp/files/mmkv');
initializeMFERegistry();
```

---

### getMFEState

Get current state of an MFE.

```typescript
getMFEState(mfeId: string): MFEState
```

**Returns:** `'' | 'loading' | 'loaded' | 'mounted' | 'error'`

---

### getMFEMetadata

Get full metadata for an MFE.

```typescript
getMFEMetadata(mfeId: string): MFEMetadata | null
```

**Returns:**
```typescript
interface MFEMetadata {
  state: MFEState;
  version?: string;
  loadedAt?: number;
  mountedAt?: number;
  unmountedAt?: number;
  errorMessage?: string;
  loadTimeMs?: number;
}
```

---

### setMFEState

Set MFE state with optional metadata.

```typescript
setMFEState(mfeId: string, state: MFEState, metadata?: Partial<MFEMetadata>): void
```

---

### markMFELoading

Mark an MFE as loading.

```typescript
markMFELoading(mfeId: string): void
```

---

### markMFELoaded

Mark an MFE as loaded with optional version.

```typescript
markMFELoaded(mfeId: string, version?: string): void
```

---

### markMFEMounted

Mark an MFE as mounted.

```typescript
markMFEMounted(mfeId: string): void
```

---

### markMFEUnmounted

Mark an MFE as unmounted.

```typescript
markMFEUnmounted(mfeId: string, keepLoaded?: boolean): void
```

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `mfeId` | `string` | - | MFE identifier |
| `keepLoaded` | `boolean` | `false` | If true, state becomes 'loaded' instead of '' |

---

### markMFEError

Mark an MFE as errored.

```typescript
markMFEError(mfeId: string, errorMessage?: string): void
```

---

### clearMFEState

Clear MFE state entirely.

```typescript
clearMFEState(mfeId: string): void
```

---

### getTrackedMFEs

Get metadata for multiple MFEs.

```typescript
getTrackedMFEs(knownMFEs: string[]): Record<string, MFEMetadata | null>
```

---

### isMFETrackingAvailable

Check if MFE tracking is available (MMKV initialized).

```typescript
isMFETrackingAvailable(): boolean
```

---

## Configuration

### configure

Set global configuration options.

```typescript
SideFx.configure(config: SAMConfig): void
```

**SAMConfig:**
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `debug` | `boolean` | `false` | Enable debug logging |
| `maxListeners` | `number` | `100` | Maximum number of listeners |
| `cacheSize` | `number` | `1000` | Value cache size limit |

**Example:**
```typescript
SideFx.configure({
  debug: true,
  maxListeners: 200
});
```

---

### setDebugMode

Enable or disable debug logging.

```typescript
SideFx.setDebugMode(enabled: boolean): void
```

---

### isDebugMode

Get current debug mode status.

```typescript
SideFx.isDebugMode(): boolean
```

---

### getVersion

Get S.A.M version.

```typescript
SideFx.getVersion(): string
```

---

### checkMMKVChanges

Manually trigger MMKV change detection.

```typescript
SideFx.checkMMKVChanges(): void
```

---

### checkColdChanges

Manually trigger Cold storage change detection.

```typescript
Air.checkColdChanges(databaseName: string, table?: string): void
```

---

## Types

### ListenerResult

```typescript
interface ListenerResult {
  success: boolean;
  error?: string;
}
```

### ListenerConfig

```typescript
interface ListenerConfig {
  warm?: WarmListenerConfig;
  cold?: ColdListenerConfig;
  combined?: CombinedListenerConfig;
  options?: ListenerOptions;
}
```

### WarmListenerConfig

```typescript
interface WarmListenerConfig {
  keys?: string[];           // Exact keys to watch
  patterns?: string[];       // Glob patterns
  conditions?: Condition[];  // Conditional triggers
  instanceId?: string;       // Warm instance (default: "default")
}
```

### ColdListenerConfig

```typescript
interface ColdListenerConfig {
  table?: string;                    // Table to watch
  columns?: string[];                // Specific columns
  operations?: ColdOperation[];      // INSERT, UPDATE, DELETE
  where?: RowCondition[];            // Row-level conditions
  query?: string;                    // Watch query results
  queryParams?: Array<string | number | null>;
  databaseName?: string;
}
```

### ListenerOptions

```typescript
interface ListenerOptions {
  debounceMs?: number;      // Wait for inactivity
  throttleMs?: number;      // Minimum interval
  fireImmediately?: boolean; // Fire on registration
  debug?: boolean;          // Enable debug logging
}
```

### ChangeEvent

```typescript
interface ChangeEvent {
  listenerId: string;
  source: 'warm' | 'cold' | 'mmkv' | 'sqlite';
  key?: string;              // For MMKV
  table?: string;            // For SQLite
  rowId?: number;            // For SQLite
  operation: 'set' | 'delete' | 'insert' | 'update';
  oldValue?: unknown;
  newValue?: unknown;
  row?: RowData;             // For SQLite
  timestamp: number;
}
```

### ListenerInfo

```typescript
interface ListenerInfo {
  id: string;
  config: ListenerConfig;
  createdAt: number;
  triggerCount: number;
  lastTriggered?: number;
  isPaused: boolean;
}
```

### ColdOperation

```typescript
type ColdOperation = 'INSERT' | 'UPDATE' | 'DELETE';
```

### Condition

```typescript
interface Condition {
  type: ConditionType;
  value?: string | number | boolean;
  values?: Array<string | number>;
  regex?: string;
}
```

See [CONDITIONS.md](./CONDITIONS.md) for full condition type reference.
