# S.A.M Secure Storage

Secure credential storage using iOS Keychain and Android Keystore.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [React Hooks](#react-hooks)
- [Biometric Authentication](#biometric-authentication)
- [Security Levels](#security-levels)
- [Best Practices](#best-practices)

---

## Overview

S.A.M provides a unified API for secure credential storage across platforms:

| Platform | Backend | Features |
|----------|---------|----------|
| **iOS** | Keychain Services | iCloud sync, Face ID, Touch ID, accessibility levels |
| **Android** | Keystore + EncryptedSharedPreferences | Fingerprint, Face unlock, security levels |

### When to Use Secure Storage

- API tokens and refresh tokens
- User credentials (username/password)
- Encryption keys
- Sensitive user data
- OAuth tokens
- Biometric-protected secrets

### When NOT to Use Secure Storage

- Large data (use encrypted MMKV instead)
- Frequently accessed data (Keychain is slower than MMKV)
- Non-sensitive preferences (use MMKV)

---

## Installation

Secure storage requires the optional `react-native-keychain` peer dependency:

```bash
# npm
npm install react-native-keychain

# pnpm
pnpm add react-native-keychain

# yarn
yarn add react-native-keychain
```

### iOS Setup

```bash
cd ios && pod install
```

For Face ID, add to your `Info.plist`:

```xml
<key>NSFaceIDUsageDescription</key>
<string>Authenticate to access your secure data</string>
```

### Android Setup

No additional setup required. Auto-links with React Native 0.60+.

For biometrics, ensure your `minSdkVersion` is 23+ in `android/build.gradle`.

---

## Quick Start

### Basic Credential Storage

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
  console.log(`Password: ${credentials.password}`);
}

// Check if credentials exist
const hasCredentials = await SecureStorage.has({ service: 'my-app-auth' });

// Delete credentials
await SecureStorage.delete({ service: 'my-app-auth' });
```

### With React Hook

```typescript
import { useSecure } from 'react-native-s-a-m';

function LoginScreen() {
  const {
    key,           // stored username
    value,         // stored password
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

  if (isLoading) return <ActivityIndicator />;

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

---

## API Reference

### SecureStorage.isAvailable()

Check if secure storage is available on the device.

```typescript
const available = SecureStorage.isAvailable();
// Returns: boolean
```

---

### SecureStorage.getSupportedBiometryType()

Get the device's supported biometry type.

```typescript
const biometry = await SecureStorage.getSupportedBiometryType();
// Returns: 'TouchID' | 'FaceID' | 'Fingerprint' | 'Face' | 'Iris' | null
```

**Example:**

```typescript
const biometry = await SecureStorage.getSupportedBiometryType();

switch (biometry) {
  case 'FaceID':
    console.log('Device supports Face ID');
    break;
  case 'TouchID':
    console.log('Device supports Touch ID');
    break;
  case 'Fingerprint':
    console.log('Device supports fingerprint');
    break;
  case 'Face':
    console.log('Device supports face unlock');
    break;
  default:
    console.log('No biometrics available');
}
```

---

### SecureStorage.set()

Store credentials securely.

```typescript
await SecureStorage.set(
  key: string,      // Username or key identifier
  value: string,    // Password or secret value
  options?: SecureStorageOptions
): Promise<SecureResult>
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `service` | `string` | `'sam-secure'` | Service namespace |
| `accessible` | `SecureAccessible` | `'AfterFirstUnlock'` | iOS keychain accessibility |
| `securityLevel` | `SecureSecurityLevel` | `'any'` | Android security level |
| `requireBiometrics` | `boolean` | `false` | Require biometric auth |
| `authenticationPrompt` | `object` | - | Biometric prompt options |

**Example:**

```typescript
const result = await SecureStorage.set('user@example.com', 'myPassword123', {
  service: 'my-app-login',
  accessible: 'WhenUnlockedThisDeviceOnly',
  requireBiometrics: true,
  authenticationPrompt: {
    title: 'Authenticate',
    subtitle: 'Save your credentials securely',
    description: 'Use biometrics to protect your login',
    cancel: 'Cancel',
  },
});

if (result.success) {
  console.log('Credentials saved securely');
} else {
  console.error('Failed to save:', result.error);
}
```

---

### SecureStorage.get()

Retrieve stored credentials.

```typescript
await SecureStorage.get(
  options?: SecureStorageOptions
): Promise<SecureCredentials | null>
```

**Returns:**

```typescript
interface SecureCredentials {
  username: string;  // The key/username
  password: string;  // The value/password
  service: string;   // Service namespace
}
```

**Example:**

```typescript
const credentials = await SecureStorage.get({
  service: 'my-app-login',
  authenticationPrompt: {
    title: 'Verify Identity',
    subtitle: 'Access your saved credentials',
  },
});

if (credentials) {
  // Auto-fill login form
  setEmail(credentials.username);
  setPassword(credentials.password);
}
```

---

### SecureStorage.has()

Check if credentials exist for a service.

```typescript
await SecureStorage.has(options?: SecureStorageOptions): Promise<boolean>
```

**Example:**

```typescript
const hasCredentials = await SecureStorage.has({ service: 'my-app-login' });

if (hasCredentials) {
  // Show "Login with saved credentials" button
  showBiometricLoginButton();
} else {
  // Show regular login form
  showLoginForm();
}
```

---

### SecureStorage.delete()

Delete stored credentials.

```typescript
await SecureStorage.delete(options?: SecureStorageOptions): Promise<SecureResult>
```

**Example:**

```typescript
const result = await SecureStorage.delete({ service: 'my-app-login' });

if (result.success) {
  console.log('Credentials deleted');
  navigation.navigate('Login');
}
```

---

### SecureStorage.getAllServices()

Get all stored service names.

```typescript
await SecureStorage.getAllServices(): Promise<string[]>
```

**Example:**

```typescript
const services = await SecureStorage.getAllServices();
// ['my-app-login', 'api-tokens', 'encryption-keys']

// Delete all stored credentials
for (const service of services) {
  await SecureStorage.delete({ service });
}
```

---

### Internet Credentials

For server-specific credentials (e.g., API endpoints):

```typescript
// Store
await SecureStorage.setInternetCredentials(
  'api.example.com',
  'apiUser',
  'apiSecret',
  { accessible: 'WhenUnlocked' }
);

// Retrieve
const creds = await SecureStorage.getInternetCredentials('api.example.com');

// Delete
await SecureStorage.deleteInternetCredentials('api.example.com');
```

---

## React Hooks

### useSecure

Full-featured hook for secure storage management.

```typescript
import { useSecure } from 'react-native-s-a-m';

function SecureComponent() {
  const {
    key,              // Stored username/key
    value,            // Stored password/value
    isLoading,        // Operation in progress
    error,            // Error message
    isAvailable,      // Secure storage available
    biometryType,     // Device biometry type
    set,              // Store credentials
    get,              // Retrieve credentials
    has,              // Check if exists
    delete: remove,   // Delete credentials
    clear,            // Clear local state only
  } = useSecure({
    service: 'my-service',
    autoLoad: true,
    requireBiometrics: false,
  });

  // ...
}
```

### useSecureCredentials

Simplified read-only hook for watching credentials.

```typescript
import { useSecureCredentials } from 'react-native-s-a-m';

function AuthProvider({ children }) {
  const { credentials, isLoading, error, refresh } = useSecureCredentials({
    service: 'auth-service',
  });

  if (isLoading) return <Splash />;

  return (
    <AuthContext.Provider value={{
      isAuthenticated: !!credentials,
      user: credentials?.username,
      refresh,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

## Biometric Authentication

### Checking Biometry Support

```typescript
import { SecureStorage } from 'react-native-s-a-m';

async function checkBiometrics() {
  const biometryType = await SecureStorage.getSupportedBiometryType();

  if (!biometryType) {
    // Device doesn't support biometrics
    // Fall back to PIN/password
    return false;
  }

  return true;
}
```

### Storing with Biometrics

```typescript
await SecureStorage.set('user', 'password', {
  service: 'biometric-auth',
  requireBiometrics: true,
  accessible: 'WhenPasscodeSetThisDeviceOnly',  // Most secure
  authenticationPrompt: {
    title: 'Enable Biometric Login',
    subtitle: 'Protect your account with biometrics',
    description: 'Your credentials will be securely stored',
    cancel: 'Use Password Instead',
  },
});
```

### Retrieving with Biometrics

```typescript
const credentials = await SecureStorage.get({
  service: 'biometric-auth',
  authenticationPrompt: {
    title: 'Login',
    subtitle: 'Verify your identity',
  },
});

if (credentials) {
  // User authenticated successfully
  loginWithCredentials(credentials.username, credentials.password);
}
```

### Biometric Login Flow

```typescript
function BiometricLoginButton() {
  const { biometryType, get, isLoading, error } = useSecure({
    service: 'biometric-auth',
    requireBiometrics: true,
    autoLoad: false,  // Don't auto-load, wait for button press
  });

  const handleBiometricLogin = async () => {
    await get();  // Triggers biometric prompt
  };

  if (!biometryType) return null;

  const buttonText = biometryType === 'FaceID'
    ? 'Login with Face ID'
    : biometryType === 'TouchID'
    ? 'Login with Touch ID'
    : 'Login with Biometrics';

  return (
    <TouchableOpacity
      onPress={handleBiometricLogin}
      disabled={isLoading}
    >
      <Text>{buttonText}</Text>
    </TouchableOpacity>
  );
}
```

---

## Security Levels

### iOS Accessibility Options

Control when keychain items are accessible:

| Value | Description |
|-------|-------------|
| `'WhenUnlocked'` | Only when device is unlocked |
| `'AfterFirstUnlock'` | After first unlock until restart |
| `'WhenPasscodeSetThisDeviceOnly'` | Most secure - requires passcode, no iCloud |
| `'WhenUnlockedThisDeviceOnly'` | Unlocked, no iCloud sync |
| `'AfterFirstUnlockThisDeviceOnly'` | After first unlock, no iCloud |

**Recommended for sensitive data:**

```typescript
await SecureStorage.set('apiKey', 'secret', {
  accessible: 'WhenPasscodeSetThisDeviceOnly',
});
```

### Android Security Levels

| Value | Description |
|-------|-------------|
| `'any'` | No specific requirements |
| `'software'` | Software-backed keystore |
| `'hardware'` | Hardware-backed keystore (TEE/StrongBox) |

**Recommended for sensitive data:**

```typescript
await SecureStorage.set('apiKey', 'secret', {
  securityLevel: 'hardware',
});
```

---

## Best Practices

### 1. Use Unique Service Names

```typescript
// Good - specific service names
await SecureStorage.set('user', 'pass', { service: 'my-app-login' });
await SecureStorage.set('key', 'token', { service: 'my-app-api' });

// Bad - generic names that might conflict
await SecureStorage.set('user', 'pass', { service: 'default' });
```

### 2. Handle Errors Gracefully

```typescript
try {
  const result = await SecureStorage.set('user', 'pass', {
    requireBiometrics: true,
  });

  if (!result.success) {
    // User cancelled biometric prompt or other error
    showFallbackLogin();
  }
} catch (error) {
  // Keychain not available or other system error
  console.error('Secure storage error:', error);
  showFallbackLogin();
}
```

### 3. Check Availability First

```typescript
function SecureFeature() {
  const { isAvailable } = useSecure({ service: 'test' });

  if (!isAvailable) {
    return <Text>Secure storage not available on this device</Text>;
  }

  return <SecureContent />;
}
```

### 4. Use Appropriate Accessibility Levels

```typescript
// For OAuth tokens that need to refresh in background
await SecureStorage.set('refreshToken', token, {
  accessible: 'AfterFirstUnlock',  // Available after first unlock
});

// For highly sensitive data
await SecureStorage.set('encryptionKey', key, {
  accessible: 'WhenPasscodeSetThisDeviceOnly',  // Most secure
  requireBiometrics: true,
});
```

### 5. Clear Credentials on Logout

```typescript
async function logout() {
  // Clear all app credentials
  await SecureStorage.delete({ service: 'auth-credentials' });
  await SecureStorage.delete({ service: 'api-tokens' });

  // Navigate to login
  navigation.reset({ routes: [{ name: 'Login' }] });
}
```

### 6. Migrate from Other Storage

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

async function migrateCredentials() {
  // Check if already migrated
  const migrated = await AsyncStorage.getItem('credentials_migrated');
  if (migrated) return;

  // Get old credentials
  const oldToken = await AsyncStorage.getItem('auth_token');

  if (oldToken) {
    // Move to secure storage
    await SecureStorage.set('token', oldToken, {
      service: 'auth',
      accessible: 'AfterFirstUnlock',
    });

    // Delete from insecure storage
    await AsyncStorage.removeItem('auth_token');
  }

  // Mark as migrated
  await AsyncStorage.setItem('credentials_migrated', 'true');
}
```

---

## Troubleshooting

### "Keychain not available"

- Ensure `react-native-keychain` is installed
- Run `pod install` on iOS
- Rebuild the app

### Biometric prompt not showing

- Check `NSFaceIDUsageDescription` in Info.plist (iOS)
- Ensure device has biometrics enrolled
- Check `requireBiometrics: true` is set

### Data not persisting

- Check the `accessible` level isn't too restrictive
- Ensure service name is consistent
- Check for errors in the result object

### Android: "No hardware security"

- Some devices don't support hardware-backed keystore
- Fall back to `securityLevel: 'software'`
