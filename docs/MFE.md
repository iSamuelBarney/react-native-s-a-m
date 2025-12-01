# MFE State Tracking

Track micro-frontend (MFE) loading states across your app.

## Overview

S.A.M provides built-in support for tracking MFE lifecycle states using Warm storage. This enables:

- Cross-MFE state visibility
- Loading/error state tracking
- Version tracking
- Mount/unmount lifecycle events

## Quick Start

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
```

## React Hooks

### useMFEState

Watch a single MFE's state:

```typescript
function MFELoader({ mfeId }: { mfeId: string }) {
  const { state, metadata, isLoading, isError, isMounted } = useMFEState(mfeId);

  if (isLoading) return <Spinner />;
  if (isError) return <Error message={metadata?.errorMessage} />;
  if (isMounted) return <Text>MFE Active (v{metadata?.version})</Text>;

  return <Text>State: {state}</Text>;
}
```

### useMFEStates

Watch multiple MFEs:

```typescript
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

### useMFEControl

Control MFE lifecycle imperatively:

```typescript
function MFEManager({ mfeId }: { mfeId: string }) {
  const { loading, loaded, mounted, unmounted, error, clear } = useMFEControl(mfeId);

  const handleLoad = async () => {
    loading();
    try {
      await loadModule(mfeId);
      loaded('1.0.0');
      mounted();
    } catch (e) {
      error(e.message);
    }
  };

  return <Button title="Load MFE" onPress={handleLoad} />;
}
```

## API Reference

### Initialization

| Function | Description |
|----------|-------------|
| `initializeMFERegistry(warmRootPath?)` | Initialize the MFE registry. On Android, pass the Warm root path. |

### Lifecycle Functions

| Function | Description |
|----------|-------------|
| `markMFELoading(mfeId)` | Mark an MFE as loading |
| `markMFELoaded(mfeId, version?)` | Mark an MFE as loaded with optional version |
| `markMFEMounted(mfeId)` | Mark an MFE as mounted (active in UI) |
| `markMFEUnmounted(mfeId, keepLoaded?)` | Mark an MFE as unmounted |
| `markMFEError(mfeId, errorMessage?)` | Mark an MFE as failed |
| `clearMFEState(mfeId)` | Clear all state for an MFE |

### Query Functions

| Function | Description |
|----------|-------------|
| `getMFEState(mfeId)` | Get the current state string |
| `getMFEMetadata(mfeId)` | Get full metadata object |
| `getTrackedMFEs(knownMFEs)` | Get metadata for multiple MFEs |

### MFERegistry Object

A convenience object grouping all functions:

```typescript
import { MFERegistry } from 'react-native-s-a-m';

MFERegistry.initialize();
MFERegistry.loading('checkout');
MFERegistry.loaded('checkout', '1.0.0');
MFERegistry.mounted('checkout');
MFERegistry.unmounted('checkout');
MFERegistry.error('checkout', 'Network error');
MFERegistry.clear('checkout');

const state = MFERegistry.getState('checkout');
const metadata = MFERegistry.getMetadata('checkout');
```

## State Values

| State | Description |
|-------|-------------|
| `''` (empty) | Not loaded |
| `'loading'` | Currently loading |
| `'loaded'` | Loaded but not mounted |
| `'mounted'` | Loaded and active in UI |
| `'error'` | Failed to load |
| `'1.0.0'` (version) | Loaded with specific version |

## Metadata Object

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

## Fallback Mode

When the native module isn't available (e.g., in Expo Go), MFE tracking automatically falls back to an in-memory store. This ensures your app works during development even without a native build.

```typescript
import { isMFETrackingAvailable } from 'react-native-s-a-m';

if (!isMFETrackingAvailable()) {
  console.log('Using in-memory fallback - rebuild for persistence');
}
```
