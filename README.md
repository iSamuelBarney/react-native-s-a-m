<p align="center">
  <img src="./assets/logo.png" alt="S.A.M Logo" width="150" />
</p>

<h1 align="center">react-native-s-a-m</h1>

<p align="center">
  <strong>S.A.M</strong> — Surface-to-Air Missile for State Management
</p>

<p align="center">
  <em>"State that persists. Storage that reacts."</em>
</p>

<p align="center">
  Lock on to your state. Never miss a change.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/react-native-s-a-m"><img src="https://img.shields.io/npm/v/react-native-s-a-m.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/react-native-s-a-m"><img src="https://img.shields.io/npm/dm/react-native-s-a-m.svg" alt="npm downloads" /></a>
  <a href="https://github.com/module-federation/metro/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/react-native-s-a-m.svg" alt="license" /></a>
</p>

---

A high-performance Nitro Module for React Native that provides reactive listeners for MMKV (warm) and SQLite (cold) storage changes. Enables automatic component updates when storage changes — no polling, no boilerplate, just reactive persistence.

## Why S.A.M?

| Pain Point | Redux/Zustand/Jotai | S.A.M |
|------------|---------------------|-------|
| **Persistence** | Requires middleware setup | Built-in — storage IS your state |
| **Boilerplate** | Actions, reducers, persist config | Zero config reactive listeners |
| **Storage Sync** | Manual cross-tab handling | Automatic cross-instance sync |
| **Native Performance** | JS-only | C++ via Nitro Modules |
| **Warm + Cold Storage** | Not supported | MMKV + SQLite unified |
| **Secure Storage** | Separate library needed | Built-in Keychain/Keystore |

## Features

- **Reactive Storage** — Automatic notifications on MMKV and SQLite changes
- **Pattern Matching** — Watch keys with glob patterns (`user.*`, `settings.*.enabled`)
- **Conditional Triggers** — Fire only when conditions are met (equals, greaterThan, contains, etc.)
- **Rate Limiting** — Built-in debounce and throttle support
- **React Hooks** — `useWarm`, `useCold`, `useStorage`, `useSecure` for declarative usage
- **Secure Storage** — iOS Keychain / Android Keystore integration with biometric auth
- **MFE Tracking** — Track micro-frontend loading states and lifecycle
- **Native Performance** — C++ implementation via [Nitro Modules](https://github.com/mrousavy/nitro)

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [MMKV (Warm Storage)](#mmkv-warm-storage)
- [SQLite (Cold Storage)](#sqlite-cold-storage)
- [Secure Storage](#secure-storage)
- [React Hooks](#react-hooks)
- [MFE State Tracking](#mfe-state-tracking)
- [API Overview](#api-overview)
- [Documentation](#documentation)

---

## Installation

```bash
npm install react-native-s-a-m react-native-nitro-modules
# or
pnpm add react-native-s-a-m react-native-nitro-modules
# or
yarn add react-native-s-a-m react-native-nitro-modules
```

### Requirements

- React Native >= 0.76.0
- React >= 18.0.0
- react-native-nitro-modules >= 0.31.0

### Optional Dependencies

```bash
# For Secure Storage (iOS Keychain / Android Keystore)
npm install react-native-keychain

# For shared storage with react-native-mmkv v4
npm install react-native-mmkv
```

### iOS Setup

```bash
cd ios && pod install
```

For Face ID support, add to `Info.plist`:
```xml
<key>NSFaceIDUsageDescription</key>
<string>Authenticate to access secure data</string>
```

### Android Setup

No additional setup required — auto-links with React Native.

---

## Quick Start

### Initialize Storage

```typescript
import { SideFx } from 'react-native-s-a-m';
import { Platform } from 'react-native';

// Android requires setting the MMKV path first
if (Platform.OS === 'android') {
  SideFx.setMMKVRootPath('/data/data/com.yourapp/files/mmkv');
}

// Initialize MMKV instances
SideFx.initializeMMKV('default');

// Initialize SQLite database
SideFx.initializeSQLite('app-db', '/path/to/database.db');
```

> **Note:** S.A.M uses MMKVCore directly and does NOT require `react-native-mmkv`. However, if you also use `react-native-mmkv` v4, both libraries share the same storage files for seamless integration.

---

## MMKV (Warm Storage)

Fast key-value storage for frequently accessed data.

### Basic Operations

```typescript
import { SideFx } from 'react-native-s-a-m';

// Set values (string, number, or boolean)
SideFx.setMMKV('user.name', 'John Doe');
SideFx.setMMKV('user.age', 28);
SideFx.setMMKV('user.premium', true);
SideFx.setMMKV('settings.theme', 'dark');

// Get values
const name = SideFx.getMMKV('user.name');      // 'John Doe'
const age = SideFx.getMMKV('user.age');        // 28
const isPremium = SideFx.getMMKV('user.premium'); // true

// Delete values
SideFx.deleteMMKV('user.name');

// Use named instances
SideFx.initializeMMKV('secure');
SideFx.setMMKV('api.token', 'abc123', 'secure');
```

### Reactive Listeners

```typescript
import { SideFx } from 'react-native-s-a-m';

// Watch specific keys
SideFx.addListener(
  'user-watcher',
  {
    mmkv: {
      keys: ['user.name', 'user.email', 'user.avatar'],
    },
  },
  (event) => {
    console.log(`${event.key} changed from ${event.oldValue} to ${event.newValue}`);
  }
);

// Watch with glob patterns
SideFx.addListener(
  'settings-watcher',
  {
    mmkv: {
      patterns: ['settings.*', 'preferences.*.enabled'],
    },
  },
  (event) => {
    console.log(`Setting changed: ${event.key}`);
  }
);

// Watch with conditions
SideFx.addListener(
  'cart-total-watcher',
  {
    mmkv: {
      keys: ['cart.total'],
      conditions: [
        { type: 'greaterThan', value: 100 }
      ],
    },
  },
  (event) => {
    // Only fires when cart total exceeds $100
    showFreeShippingBanner();
  }
);

// With debounce for rapid changes
SideFx.addListener(
  'search-watcher',
  {
    mmkv: {
      keys: ['search.query'],
    },
    options: {
      debounceMs: 300,  // Wait 300ms after last change
    },
  },
  (event) => {
    performSearch(event.newValue as string);
  }
);

// Remove listener when done
SideFx.removeListener('user-watcher');
```

---

## SQLite (Cold Storage)

Persistent relational data with SQL queries.

### Basic Operations

```typescript
import { SideFx } from 'react-native-s-a-m';

// Create tables
SideFx.executeSQLite(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

SideFx.executeSQLite(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    total REAL,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Insert data
SideFx.executeSQLite(
  'INSERT INTO users (name, email) VALUES (?, ?)',
  ['John Doe', 'john@example.com']
);

// Query data with TypeScript
interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

const users = SideFx.querySQLite<User[]>('SELECT * FROM users');

const user = SideFx.querySQLite<User[]>(
  'SELECT * FROM users WHERE id = ?',
  [1]
)?.[0];

// Update data
SideFx.executeSQLite(
  'UPDATE users SET name = ? WHERE id = ?',
  ['Jane Doe', 1]
);

// Delete data
SideFx.executeSQLite('DELETE FROM users WHERE id = ?', [1]);
```

### Reactive Listeners

```typescript
import { SideFx } from 'react-native-s-a-m';

// Watch all changes to a table
SideFx.addListener(
  'users-watcher',
  {
    sqlite: {
      table: 'users',
      operations: ['INSERT', 'UPDATE', 'DELETE'],
    },
  },
  (event) => {
    console.log(`${event.operation} on row ${event.rowId}`);
    refreshUserList();
  }
);

// Watch specific columns
SideFx.addListener(
  'order-status-watcher',
  {
    sqlite: {
      table: 'orders',
      columns: ['status'],
      operations: ['UPDATE'],
    },
  },
  (event) => {
    notifyOrderStatusChange(event.rowId);
  }
);

// Watch with row conditions
SideFx.addListener(
  'high-value-orders',
  {
    sqlite: {
      table: 'orders',
      operations: ['INSERT'],
      where: [
        {
          column: 'total',
          condition: { type: 'greaterThan', value: 1000 }
        }
      ],
    },
  },
  (event) => {
    alertSalesTeam(event.rowId);
  }
);
```

---

## Secure Storage

iOS Keychain and Android Keystore integration for sensitive data.

**Requires:** `npm install react-native-keychain`

### Basic Usage

```typescript
import { SecureStorage } from 'react-native-s-a-m';

// Store credentials
await SecureStorage.set('admin', 'super-secret-password', {
  service: 'my-app-auth',
});

// Retrieve credentials
const credentials = await SecureStorage.get({ service: 'my-app-auth' });
if (credentials) {
  console.log(`User: ${credentials.username}`);
  console.log(`Pass: ${credentials.password}`);
}

// Check if credentials exist
const hasCredentials = await SecureStorage.has({ service: 'my-app-auth' });

// Delete credentials
await SecureStorage.delete({ service: 'my-app-auth' });
```

### With Biometric Authentication

```typescript
import { SecureStorage } from 'react-native-s-a-m';

// Check biometry support
const biometryType = await SecureStorage.getSupportedBiometryType();
// Returns: 'FaceID' | 'TouchID' | 'Fingerprint' | 'Face' | 'Iris' | null

// Store with biometric protection
await SecureStorage.set('user@example.com', 'password123', {
  service: 'biometric-auth',
  requireBiometrics: true,
  accessible: 'WhenPasscodeSetThisDeviceOnly',
  authenticationPrompt: {
    title: 'Save Credentials',
    subtitle: 'Protect your login with biometrics',
  },
});

// Retrieve with biometric prompt
const credentials = await SecureStorage.get({
  service: 'biometric-auth',
  authenticationPrompt: {
    title: 'Login',
    subtitle: 'Verify your identity to continue',
  },
});
```

### React Hook

```typescript
import { useSecure } from 'react-native-s-a-m';

function LoginScreen() {
  const {
    key,              // stored username
    value,            // stored password
    isLoading,
    error,
    biometryType,
    set,
    get,
    delete: remove,
  } = useSecure({
    service: 'auth-credentials',
    autoLoad: true,
    requireBiometrics: true,
  });

  const handleLogin = async (username: string, password: string) => {
    const success = await set(username, password);
    if (success) {
      navigation.navigate('Home');
    }
  };

  const handleBiometricLogin = async () => {
    await get();  // Triggers biometric prompt
    if (key && value) {
      await loginWithCredentials(key, value);
    }
  };

  if (isLoading) return <ActivityIndicator />;

  return (
    <View>
      {biometryType && (
        <Button
          title={`Login with ${biometryType}`}
          onPress={handleBiometricLogin}
        />
      )}
      <LoginForm onSubmit={handleLogin} />
    </View>
  );
}
```

---

## React Hooks

### useWarm — Watch MMKV Changes

```typescript
import { useWarm, SideFx } from 'react-native-s-a-m';

function UserProfile() {
  // Re-renders when any watched key changes
  const { isListening, pause, resume } = useWarm(
    {
      keys: ['user.name', 'user.email', 'user.avatar'],
      options: {
        fireImmediately: true,
        debounceMs: 100,
      },
    },
    (event) => {
      console.log(`${event.key} changed to ${event.newValue}`);
    }
  );

  const name = SideFx.getMMKV('user.name');
  const email = SideFx.getMMKV('user.email');

  return (
    <View>
      <Text>{name ?? 'Guest'}</Text>
      <Text>{email ?? 'No email'}</Text>
      <Button
        title={isListening ? 'Pause' : 'Resume'}
        onPress={isListening ? pause : resume}
      />
    </View>
  );
}
```

### useCold — Watch SQLite Changes

```typescript
import { useCold, SideFx } from 'react-native-s-a-m';

function OrdersList() {
  const { lastChange, refresh } = useCold(
    {
      table: 'orders',
      operations: ['INSERT', 'UPDATE', 'DELETE'],
    },
    (event) => {
      // Refresh list when orders change
      console.log(`Order ${event.rowId} ${event.operation}`);
    }
  );

  const orders = SideFx.querySQLite<Order[]>(
    'SELECT * FROM orders ORDER BY created_at DESC'
  );

  return (
    <FlatList
      data={orders}
      renderItem={({ item }) => <OrderRow order={item} />}
      refreshing={false}
      onRefresh={refresh}
    />
  );
}
```

### useStorage — Watch Both MMKV and SQLite

```typescript
import { useStorage, SideFx } from 'react-native-s-a-m';

function UserOrders() {
  const { lastSource } = useStorage(
    {
      warm: {
        keys: ['auth.userId'],
      },
      cold: {
        table: 'orders',
        operations: ['INSERT', 'UPDATE'],
      },
      logic: 'OR',  // Fire on either change
      correlation: {
        warmKey: 'auth.userId',
        coldParam: 'user_id',
      },
    },
    (event) => {
      console.log(`Change from ${event.source}`);
    }
  );

  const userId = SideFx.getMMKV('auth.userId');
  const orders = SideFx.querySQLite<Order[]>(
    'SELECT * FROM orders WHERE user_id = ?',
    [userId]
  );

  return <OrderList orders={orders} />;
}
```

---

## MFE State Tracking

Track micro-frontend loading states across your app.

```typescript
import {
  initializeMFERegistry,
  markMFELoading,
  markMFELoaded,
  markMFEMounted,
  markMFEUnmounted,
  markMFEError,
  useMFEState,
  useMFEStates,
} from 'react-native-s-a-m';

// Initialize at app start
initializeMFERegistry();

// Track MFE lifecycle
async function loadMFE(mfeId: string) {
  markMFELoading(mfeId);

  try {
    const module = await import(`./mfes/${mfeId}`);
    markMFELoaded(mfeId, module.version);
    return module;
  } catch (error) {
    markMFEError(mfeId, error.message);
    throw error;
  }
}

// React component to track state
function MFELoader({ mfeId }: { mfeId: string }) {
  const { state, metadata, isLoading, isError, isMounted } = useMFEState(mfeId);

  if (isLoading) return <Spinner />;
  if (isError) return <Error message={metadata?.errorMessage} />;
  if (isMounted) return <Text>MFE Active (v{metadata?.version})</Text>;

  return <Text>State: {state}</Text>;
}

// Track multiple MFEs
function MFEDashboard() {
  const { getMounted, getLoading, getErrors } = useMFEStates([
    'checkout',
    'profile',
    'cart',
  ]);

  return (
    <View>
      <Text>Active: {getMounted().join(', ')}</Text>
      <Text>Loading: {getLoading().join(', ')}</Text>
      <Text>Errors: {getErrors().join(', ')}</Text>
    </View>
  );
}
```

---

## API Overview

### Core Storage

| Method | Description |
|--------|-------------|
| `SideFx.initializeMMKV(id?)` | Initialize MMKV instance |
| `SideFx.initializeSQLite(name, path)` | Initialize SQLite database |
| `SideFx.setMMKV(key, value, id?)` | Set MMKV value |
| `SideFx.getMMKV(key, id?)` | Get MMKV value |
| `SideFx.deleteMMKV(key, id?)` | Delete MMKV key |
| `SideFx.executeSQLite(sql, params?, db?)` | Execute SQL statement |
| `SideFx.querySQLite<T>(sql, params?, db?)` | Query SQLite with types |

### Listeners

| Method | Description |
|--------|-------------|
| `SideFx.addListener(id, config, callback)` | Add storage listener |
| `SideFx.removeListener(id)` | Remove listener |
| `SideFx.pauseListener(id)` | Pause listener |
| `SideFx.resumeListener(id)` | Resume listener |
| `SideFx.getListeners()` | Get all listener info |

### React Hooks

| Hook | Description |
|------|-------------|
| `useWarm` | Watch MMKV changes |
| `useCold` | Watch SQLite changes |
| `useStorage` | Watch both with correlation |
| `useSecure` | Manage secure storage |
| `useSecureCredentials` | Watch credential changes |
| `useMFEState` | Watch single MFE |
| `useMFEStates` | Watch multiple MFEs |
| `useMFEControl` | Control MFE lifecycle |

### Secure Storage

| Method | Description |
|--------|-------------|
| `SecureStorage.set(key, value, options?)` | Store credentials |
| `SecureStorage.get(options?)` | Retrieve credentials |
| `SecureStorage.has(options?)` | Check if exists |
| `SecureStorage.delete(options?)` | Delete credentials |
| `SecureStorage.getSupportedBiometryType()` | Get biometry type |

---

## Documentation

| Document | Description |
|----------|-------------|
| [API Reference](./docs/API.md) | Complete API documentation |
| [React Hooks](./docs/HOOKS.md) | Detailed hooks documentation |
| [Conditions](./docs/CONDITIONS.md) | Conditional trigger reference |
| [Secure Storage](./docs/SECURE_STORAGE.md) | Keychain/Keystore guide |
| [Architecture](./docs/ARCHITECTURE.md) | Technical architecture overview |

---

## Building

```bash
pnpm build
```

This will:
1. Run `nitro-codegen` to generate platform-specific bindings
2. Compile TypeScript to JavaScript

---

## License

MIT
