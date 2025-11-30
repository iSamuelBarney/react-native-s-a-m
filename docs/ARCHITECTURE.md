# S.A.M Architecture

Technical architecture overview of the State Awareness Manager.

## Table of Contents

- [Overview](#overview)
- [Layer Architecture](#layer-architecture)
- [Component Diagram](#component-diagram)
- [Data Flow](#data-flow)
- [Native Module (Nitro)](#native-module-nitro)
- [JavaScript API](#javascript-api)
- [React Hooks](#react-hooks)
- [Storage Adapters](#storage-adapters)
- [Secure Storage](#secure-storage)
- [MFE State Tracking](#mfe-state-tracking)
- [Event System](#event-system)
- [Performance Considerations](#performance-considerations)

---

## Overview

S.A.M is built as a Nitro Module with a C++ core for maximum performance. It provides reactive listeners for MMKV and SQLite storage changes in React Native applications.

### Design Goals

1. **Performance** - Native C++ implementation for minimal overhead
2. **Simplicity** - Clean API with React hooks for declarative usage
3. **Flexibility** - Support for patterns, conditions, throttle/debounce
4. **Type Safety** - Full TypeScript support with generics
5. **Security** - Built-in Keychain/Keystore integration with biometrics

### Storage Types Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              S.A.M Storage System                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │    WARM STORAGE     │  │    COLD STORAGE     │  │   SECURE STORAGE    │ │
│  │       (MMKV)        │  │      (SQLite)       │  │   (Keychain/Store)  │ │
│  ├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤ │
│  │                     │  │                     │  │                     │ │
│  │ • Fast key-value    │  │ • Relational data   │  │ • Credentials       │ │
│  │ • In-memory mapped  │  │ • SQL queries       │  │ • API tokens        │ │
│  │ • Pattern matching  │  │ • Table listeners   │  │ • Encryption keys   │ │
│  │ • Sync operations   │  │ • Row conditions    │  │ • Biometric auth    │ │
│  │                     │  │                     │  │                     │ │
│  ├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤ │
│  │ Hook: useWarm()     │  │ Hook: useCold()     │  │ Hook: useSecure()   │ │
│  │ API: SideFx.*MMKV() │  │ API: SideFx.*SQL()  │  │ API: SecureStorage  │ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘ │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         MFE STATE TRACKING                           │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ • Micro-frontend lifecycle states (loading → loaded → mounted)      │   │
│  │ • Version tracking and load time metrics                            │   │
│  │ • Error state management                                            │   │
│  │ • Hooks: useMFEState(), useMFEStates(), useMFEControl()             │   │
│  │ • Backed by dedicated MMKV instance (sam.mfe)                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology |
|-------|------------|
| React Hooks | TypeScript/React |
| JavaScript API | TypeScript |
| Native Bridge | Nitro Modules |
| Core Implementation | C++ |
| Warm Storage | MMKV (memory-mapped) |
| Cold Storage | SQLite |
| Secure Storage | iOS Keychain / Android Keystore via react-native-keychain |

---

## Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           React Components                               │
│                                                                          │
│   useWarm()    useCold()    useStorage()    useSecure()    useMFEState()│
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
┌─────────────────────────────────┴────────────────────────────────────────┐
│                          JavaScript API                                   │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │    SideFx       │  │  SecureStorage  │  │   MFE Registry  │          │
│  │  (Storage API)  │  │  (Keychain API) │  │  (State Track)  │          │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘          │
└───────────┼────────────────────┼────────────────────┼────────────────────┘
            │                    │                    │
┌───────────┴────────────────────┴────────────────────┴────────────────────┐
│                          Native Bridge Layer                              │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │  Nitro Modules  │  │ react-native-   │  │    MMKV via     │          │
│  │  (HybridSideFx) │  │   keychain      │  │     SideFx      │          │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘          │
└───────────┼────────────────────┼────────────────────┼────────────────────┘
            │                    │                    │
┌───────────┴────────────────────┴────────────────────┴────────────────────┐
│                          Platform Storage                                 │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │  MMKV + SQLite  │  │  iOS Keychain   │  │ Android Keystore│          │
│  │   (C++ Core)    │  │ (Secure Enclave)│  │ (Hardware TEE)  │          │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Component Diagram

```
                              ┌─────────────────────────────────────────┐
                              │            React Hooks                   │
                              │                                         │
                              │  useWarm   useCold   useSecure   useMFE │
                              └──────────────────┬──────────────────────┘
                                                 │
                    ┌────────────────────────────┼────────────────────────────┐
                    │                            │                            │
           ┌────────▼────────┐          ┌────────▼────────┐          ┌────────▼────────┐
           │    SideFx       │          │  SecureStorage  │          │  MFE Registry   │
           │  (Storage API)  │          │  (Keychain)     │          │  (State Track)  │
           └────────┬────────┘          └────────┬────────┘          └────────┬────────┘
                    │                            │                            │
     ┌──────────────┼──────────────┐             │                            │
     │              │              │             │                            │
┌────▼────┐  ┌──────▼──────┐  ┌────▼────┐  ┌─────▼─────┐              ┌───────▼───────┐
│Callback │  │Nitro Bridge │  │ Global  │  │  react-   │              │  MMKV Storage │
│  Map    │  │             │  │ Handler │  │  native-  │              │  (sam.mfe)    │
│  (JS)   │  │             │  │__SAM_on │  │  keychain │              │               │
└─────────┘  └──────┬──────┘  │ Change  │  └─────┬─────┘              └───────────────┘
                    │         └─────────┘        │
           ┌────────▼────────┐                   │
           │  HybridSideFx   │                   │
           │  (C++)          │                   │
           └────────┬────────┘                   │
                    │                            │
     ┌──────────────┼──────────────┐             │
     │              │              │             │
┌────▼────┐  ┌──────▼──────┐  ┌────▼────┐  ┌─────▼─────┐
│  MMKV   │  │   SQLite    │  │Listener │  │   iOS     │
│ Adapter │  │   Adapter   │  │  Store  │  │ Keychain  │
└─────────┘  └─────────────┘  └─────────┘  └───────────┘
                                                 │
                                           ┌─────▼─────┐
                                           │  Android  │
                                           │ Keystore  │
                                           └───────────┘
```

---

## Data Flow

### Adding a Listener

```
1. React: useWarm({ keys: ['user.name'] }, callback)
   │
2. JavaScript: SideFx.addListener(id, config, callback)
   │
   ├─► Store callback in Map<id, callback>
   │
3. Nitro: getNativeSideFx().addListener(id, config)
   │
4. C++: HybridSideFx::addListener()
   │
   ├─► Validate config
   ├─► Create listener entry
   ├─► Register with storage adapter
   │
5. Return: ListenerResult { success: true }
```

### Change Detection & Notification

```
1. Storage: MMKV value changed
   │
2. C++: MMKVAdapter detects change
   │
3. C++: HybridSideFx::evaluateListeners()
   │
   ├─► Check patterns match
   ├─► Evaluate conditions
   ├─► Apply throttle/debounce
   │
4. C++: Call JS via global handler
   │
5. JavaScript: __SAM_onChangeEvent(event)
   │
6. JavaScript: SideFx._onChangeEvent(event)
   │
   ├─► Look up callback by listenerId
   ├─► Call callback(event)
   │
7. React: Callback triggers re-render
```

---

## Native Module (Nitro)

S.A.M uses [Nitro Modules](https://github.com/margelo/react-native-nitro-modules) for the native bridge.

### Nitro Spec

The interface is defined in `SideFx.nitro.ts`:

```typescript
export interface SideFx extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  addListener(id: string, config: ListenerConfig): ListenerResult;
  removeListener(id: string): ListenerResult;
  // ... more methods
}
```

### C++ Implementation

```cpp
// HybridSideFx.hpp
class HybridSideFx : public HybridSideFxSpec {
public:
  ListenerResult addListener(
    const std::string& id,
    const ListenerConfig& config
  ) override;

  // ... implementation
};
```

### Configuration (nitro.json)

```json
{
  "cxxNamespace": ["sam"],
  "ios": { "iosModuleName": "ReactNativeSAM" },
  "android": {
    "androidNamespace": ["com", "sam"],
    "androidCxxLibName": "ReactNativeSAM"
  },
  "autolinking": {
    "SideFx": { "cpp": "HybridSideFx" }
  }
}
```

---

## JavaScript API

### Lazy Initialization

The native module is lazily initialized to prevent crashes at module load time:

```typescript
let _nativeSideFx: SideFxSpec | null = null;

function getNativeSideFx(): SideFxSpec {
  if (_nativeSideFx === null) {
    _nativeSideFx = NitroModules.createHybridObject<SideFxSpec>('SideFx');
  }
  return _nativeSideFx;
}
```

### Callback Management

Callbacks are stored in JavaScript (not passed to native):

```typescript
const callbacks = new Map<string, ListenerCallback>();

export const SideFx = {
  addListener(id, config, callback) {
    callbacks.set(id, callback);  // Store in JS
    return getNativeSideFx().addListener(id, config);  // Config to native
  }
};
```

### Event Handler Registration

A global handler is registered for native-to-JS communication:

```typescript
(globalThis as any).__SAM_onChangeEvent = SideFx._onChangeEvent;
```

---

## React Hooks

### Hook Architecture

```typescript
function useWarm(config, callback) {
  // Unique ID persists across renders
  const listenerIdRef = useRef(generateListenerId('warm'));

  // Re-render trigger
  const [, forceUpdate] = useState({});

  // Memoized config to prevent re-registration
  const listenerConfig = useMemo(() => ({...}), [deps]);

  // Register on mount, cleanup on unmount
  useEffect(() => {
    SideFx.addListener(id, config, callback);
    return () => SideFx.removeListener(id);
  }, [config]);

  return { pause, resume, refresh };
}
```

### Automatic Cleanup

Hooks automatically remove listeners when components unmount:

```typescript
useEffect(() => {
  const result = SideFx.addListener(listenerId, config, callback);

  return () => {
    SideFx.removeListener(listenerId);  // Cleanup
  };
}, []);
```

---

## Storage Adapters

### MMKV Adapter

```cpp
class MMKVAdapter {
  std::set<std::string> _instances;
  std::map<std::string, std::map<std::string, Variant>> _cache;

  void initialize(const std::string& instanceId);
  void set(const std::string& key, const Variant& value);
  std::optional<Variant> get(const std::string& key);
  void detectChanges();
};
```

### SQLite Adapter

```cpp
class SQLiteAdapter {
  std::map<std::string, std::string> _databases;  // name -> path

  void initialize(const std::string& name, const std::string& path);
  ListenerResult execute(const std::string& sql, const Params& params);
  std::string query(const std::string& sql, const Params& params);
  void detectChanges(const std::string& table);
};
```

---

## Secure Storage

S.A.M includes secure storage capabilities that wrap `react-native-keychain` for iOS Keychain and Android Keystore integration.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Hooks                               │
│                                                              │
│   useSecure()              useSecureCredentials()           │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────────┐
│                    SecureStorage API                         │
│                                                              │
│   set()  get()  delete()  has()                             │
│   setInternetCredentials()  getInternetCredentials()        │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────────┐
│                    react-native-keychain                     │
│                                                              │
│   iOS: Keychain Services                                    │
│   Android: Keystore / EncryptedSharedPreferences            │
└──────────────────────────────────────────────────────────────┘
```

### Design Decisions

1. **Optional Peer Dependency**: `react-native-keychain` is an optional peer dependency. If not installed, `SecureStorage.isAvailable()` returns `false` and all operations are no-ops.

2. **Service-Based Namespacing**: Credentials are organized by "service" to allow multiple independent credential stores within an app.

3. **Biometric Integration**: Supports Face ID, Touch ID, and Android biometrics with customizable prompts.

4. **Accessibility Levels**: iOS keychain accessibility controls when data can be accessed (e.g., only when device is unlocked).

### Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                       Application                            │
│                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│   │  Service A  │    │  Service B  │    │  Service C  │    │
│   │  (auth)     │    │  (api-keys) │    │  (user)     │    │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    │
└──────────┼──────────────────┼──────────────────┼────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
┌──────────────────────────────────────────────────────────────┐
│              Platform Secure Storage                         │
│                                                              │
│   iOS: Keychain (hardware-backed on Secure Enclave)         │
│   Android: Keystore (hardware-backed when available)        │
└──────────────────────────────────────────────────────────────┘
```

---

## MFE State Tracking

S.A.M provides a lightweight system for tracking micro-frontend (MFE) loading states using MMKV storage.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Hooks                               │
│                                                              │
│   useMFEState()     useMFEStates()     useMFEControl()      │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────────┐
│                    MFE Registry API                          │
│                                                              │
│   markMFELoading()  markMFELoaded()  markMFEMounted()       │
│   getMFEState()     getMFEMetadata() getTrackedMFEs()       │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────────┐
│                    MMKV Storage                              │
│                                                              │
│   Instance: 'sam.mfe' (dedicated MFE registry)              │
│   Keys: 'mfe.{mfeId}.state', 'mfe.{mfeId}.metadata'         │
└──────────────────────────────────────────────────────────────┘
```

### State Machine

```
                    ┌─────────────┐
                    │    ''       │  (Initial/Unknown)
                    │  (empty)    │
                    └──────┬──────┘
                           │ markMFELoading()
                           ▼
                    ┌─────────────┐
                    │  'loading'  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            │            ▼
       ┌─────────────┐     │     ┌─────────────┐
       │  'loaded'   │     │     │   'error'   │
       └──────┬──────┘     │     └─────────────┘
              │            │            ▲
              │ markMFE    │            │
              │ Mounted()  │            │
              ▼            │            │
       ┌─────────────┐     │            │
       │  'mounted'  │◄────┘            │
       └──────┬──────┘                  │
              │                         │
              │ markMFE                 │ markMFEError()
              │ Unmounted()             │
              ▼                         │
       ┌─────────────┐                  │
       │  'loaded'   │ or '' ───────────┘
       │ (keepLoaded)│
       └─────────────┘
```

### Metadata Structure

```typescript
interface MFEMetadata {
  state: MFEState;           // Current state
  version?: string;          // Module version (from markMFELoaded)
  loadedAt?: number;         // Timestamp when loaded
  mountedAt?: number;        // Timestamp when mounted
  unmountedAt?: number;      // Timestamp when unmounted
  errorMessage?: string;     // Error message if state is 'error'
  loadTimeMs?: number;       // Time to load (loadedAt - started loading)
}
```

### Use Cases

1. **Loading Indicators**: Show spinners while MFEs load
2. **Error Handling**: Display error UI when MFE fails to load
3. **Analytics**: Track load times and success rates
4. **Debugging**: Monitor MFE lifecycle in development
5. **Coordination**: Ensure dependencies are loaded before mounting

---

## Event System

### Change Event Structure

```typescript
interface ChangeEvent {
  listenerId: string;      // Which listener triggered
  source: ChangeSource;    // 'warm' | 'cold' | 'mmkv' | 'sqlite'
  key?: string;            // For MMKV
  table?: string;          // For SQLite
  rowId?: number;          // For SQLite
  operation: ChangeOperation;
  oldValue?: unknown;
  newValue?: unknown;
  row?: RowData;           // For SQLite
  timestamp: number;
}
```

### Event Flow

```
Native Change
    │
    ▼
Pattern Matching ─── No Match ──► (skip)
    │
    │ Match
    ▼
Condition Evaluation ─── Fail ──► (skip)
    │
    │ Pass
    ▼
Throttle/Debounce ─── Wait ──► (queue)
    │
    │ Ready
    ▼
Create ChangeEvent
    │
    ▼
Call JS Handler
    │
    ▼
Invoke Callback
```

---

## Performance Considerations

### Native Evaluation

Conditions and patterns are evaluated in C++, not JavaScript:

```cpp
bool evaluateCondition(const Condition& cond, const Variant& value) {
  switch (cond.type) {
    case ConditionType::Equals:
      return value == cond.value;
    case ConditionType::GreaterThan:
      return std::get<double>(value) > std::get<double>(cond.value);
    // ...
  }
}
```

### Throttle/Debounce in Native

Rate limiting is implemented in C++ to prevent JS bridge overhead:

```cpp
bool shouldFire(const std::string& listenerId, int64_t now) {
  auto& state = _listenerState[listenerId];

  if (state.throttleMs > 0) {
    if (now - state.lastFired < state.throttleMs) {
      return false;  // Throttled
    }
  }

  return true;
}
```

### Callback Batching

Multiple changes within a short time window can be batched (when using debounce):

```
Change 1 ──┐
Change 2 ──┼── debounce(300ms) ──► Single callback with latest value
Change 3 ──┘
```

### Memory Management

- Listener configs stored in native (C++)
- Callbacks stored in JavaScript (Map)
- Values cached only when needed
- Automatic cleanup on listener removal

---

## File Structure

```
packages/react-native-s-a-m/
├── src/
│   ├── index.ts           # Main exports
│   ├── SideFx.ts          # JavaScript API wrapper
│   ├── hooks.ts           # React hooks (useWarm, useCold, useStorage)
│   ├── types.ts           # TypeScript types
│   ├── secure.ts          # Secure storage API (iOS Keychain / Android Keystore)
│   ├── useSecure.ts       # Secure storage hooks (useSecure, useSecureCredentials)
│   ├── mfe.ts             # MFE state tracking API
│   ├── useMFE.ts          # MFE hooks (useMFEState, useMFEStates, useMFEControl)
│   └── specs/
│       └── SideFx.nitro.ts       # Nitro interface spec for storage
├── cpp/
│   ├── HybridSideFx.hpp           # C++ storage implementation
│   └── SideFxImpl.hpp             # Additional implementation details
├── nitrogen/
│   └── generated/         # Auto-generated Nitro code
├── docs/
│   ├── README.md          # Quick start guide
│   ├── API.md             # Complete API reference
│   ├── HOOKS.md           # React hooks documentation
│   ├── CONDITIONS.md      # Condition types reference
│   ├── SECURE_STORAGE.md  # iOS Keychain / Android Keystore guide
│   └── ARCHITECTURE.md    # This file
├── nitro.json             # Nitro configuration
├── package.json
└── react-native-s-a-m.podspec
```
