# react-native-s-a-m

**S.A.M** - State Awareness Manager

A high-performance Nitro Module for React Native that provides reactive listeners for MMKV (warm) and SQLite (cold) storage changes. Enables automatic component updates when storage changes without polling.

## Features

- **Reactive Storage** - Automatic notifications on MMKV and SQLite changes
- **Pattern Matching** - Watch keys with glob patterns (`user.*`, `settings.*.enabled`)
- **Conditional Triggers** - Fire only when conditions are met (equals, greaterThan, contains, etc.)
- **Rate Limiting** - Built-in debounce and throttle support
- **React Hooks** - `useWarm`, `useCold`, `useStorage` for declarative usage
- **Secure Storage** - iOS Keychain / Android Keystore integration with biometric auth
- **MFE Tracking** - Track micro-frontend loading states and lifecycle
- **Native Performance** - C++ implementation via [Nitro Modules](https://github.com/mrousavy/nitro)

## Installation

```bash
pnpm add react-native-s-a-m
```

### Requirements

- React Native >= 0.76.0
- React >= 18.0.0
- react-native-nitro-modules >= 0.31.0

### Optional Dependencies

- `react-native-keychain` >= 9.0.0 (for SecureStorage)

### iOS Setup

```bash
cd ios && pod install
```

## Quick Start

### Storage Initialization

```typescript
import { SideFx } from 'react-native-s-a-m';
import { Platform } from 'react-native';

// MMKV Initialization
// On iOS: Path is auto-detected (Library/mmkv)
// On Android: You must set the path first
if (Platform.OS === 'android') {
  // Get path from your app's files directory
  SideFx.setMMKVRootPath('/data/data/com.yourapp/files/mmkv');
}

// Initialize MMKV instances
SideFx.initializeMMKV('default');
SideFx.initializeMMKV('sam');  // For app state tracking

// Initialize SQLite (cold storage)
SideFx.initializeSQLite('mydb', '/path/to/database.db');
```

> **Note:** S.A.M uses MMKVCore directly and does NOT require `react-native-mmkv` as a dependency. However, if you also use `react-native-mmkv`, both libraries share the same storage files for seamless integration.

### React Hooks

```typescript
import { useWarm, useCold } from 'react-native-s-a-m';

// Watch MMKV changes
function UserProfile() {
  const { get } = useWarm({
    keys: ['user.name', 'user.email'],
  });

  return <Text>{get('user.name') ?? 'Guest'}</Text>;
}

// Watch SQLite changes
function OrdersList() {
  const { query } = useCold({
    table: 'orders',
    operations: ['INSERT', 'UPDATE', 'DELETE'],
  });

  const orders = query();
  return <OrderList data={orders} />;
}
```

### Direct Storage Operations

```typescript
import { SideFx } from 'react-native-s-a-m';

// MMKV operations
SideFx.setMMKV('user.name', 'John');
SideFx.setMMKV('user.age', 30);
SideFx.setMMKV('user.premium', true);
const name = SideFx.getMMKV('user.name');
SideFx.deleteMMKV('user.name');

// SQLite operations
SideFx.executeSQLite('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
SideFx.executeSQLite('INSERT INTO users (name) VALUES (?)', ['John']);
const users = SideFx.querySQLite<User[]>('SELECT * FROM users');
```

### Secure Storage

```typescript
import { SecureStorage, useSecure } from 'react-native-s-a-m';

// Direct API
await SecureStorage.set('api-token', 'secret-value', {
  requireBiometrics: true,
});
const credentials = await SecureStorage.get();

// React Hook
function LoginForm() {
  const { value, set, isLoading } = useSecure({
    service: 'auth-credentials',
    autoLoad: true,
  });

  const saveToken = async (token: string) => {
    await set('token', token);
  };
}
```

### MFE State Tracking

```typescript
import { useMFEState, markMFELoaded } from 'react-native-s-a-m';

// Track MFE state in components
function MFEStatus({ mfeId }: { mfeId: string }) {
  const { state, isLoading, isMounted } = useMFEState(mfeId);

  if (isLoading) return <Spinner />;
  if (isMounted) return <Text>MFE is active</Text>;
  return <Text>State: {state}</Text>;
}

// Update MFE state
markMFELoaded('checkout-mfe', '1.2.0');
```

## API Overview

### Core Storage

| Method | Description |
|--------|-------------|
| `SideFx.getDefaultMMKVPath()` | Get platform default MMKV path |
| `SideFx.setMMKVRootPath(path)` | Set MMKV root directory (required on Android) |
| `SideFx.initializeMMKV(id?)` | Initialize MMKV instance |
| `SideFx.initializeSQLite(name, path)` | Initialize SQLite database |
| `SideFx.setMMKV(key, value, id?)` | Set MMKV value |
| `SideFx.getMMKV(key, id?)` | Get MMKV value |
| `SideFx.deleteMMKV(key, id?)` | Delete MMKV key |
| `SideFx.executeSQLite(sql, params?, db?)` | Execute SQL statement |
| `SideFx.querySQLite(sql, params?, db?)` | Query SQLite |

### React Hooks

| Hook | Description |
|------|-------------|
| `useWarm` | Watch MMKV changes with callbacks and query methods |
| `useCold` | Watch SQLite changes with callbacks and query methods |
| `useStorage` | Watch both MMKV and SQLite with correlation |
| `useSecure` | Manage secure storage with loading states |
| `useSecureCredentials` | Watch secure credential changes |
| `useMFEState` | Watch single MFE state |
| `useMFEStates` | Watch multiple MFE states |
| `useMFEControl` | Control MFE lifecycle state |

### Listener Management

| Method | Description |
|--------|-------------|
| `SideFx.addListener(id, config, callback)` | Add storage listener |
| `SideFx.removeListener(id)` | Remove listener |
| `SideFx.pauseListener(id)` | Pause listener |
| `SideFx.resumeListener(id)` | Resume listener |
| `SideFx.getListeners()` | Get all listener info |

## Documentation

- [API Reference](./docs/API.md) - Complete API documentation
- [React Hooks](./docs/HOOKS.md) - Detailed hooks documentation
- [Conditions](./docs/CONDITIONS.md) - Conditional trigger reference
- [Architecture](./docs/ARCHITECTURE.md) - Technical architecture overview

## Building

```bash
pnpm build
```

This will:
1. Run `nitro-codegen` to generate platform-specific bindings
2. Compile TypeScript to JavaScript

## License

MIT
# react-native-s-a-m
