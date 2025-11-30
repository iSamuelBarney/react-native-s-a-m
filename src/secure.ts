/**
 * S.A.M - Secure Storage
 *
 * Provides secure storage for sensitive data like auth tokens, credentials,
 * and other secrets using react-native-keychain (iOS Keychain / Android Keystore).
 *
 * This module is optional - react-native-keychain must be installed separately.
 */

// Types for react-native-keychain (we define our own to avoid hard dependency)
export interface SecureStorageOptions {
  /**
   * Service name for the keychain item (acts as a namespace)
   * @default 'sam-secure'
   */
  service?: string;

  /**
   * iOS: When the keychain item is accessible
   * @default 'AfterFirstUnlock'
   */
  accessible?: SecureAccessible;

  /**
   * Android: Security level for the keychain item
   */
  securityLevel?: SecureSecurityLevel;

  /**
   * Enable biometric authentication for accessing the item
   * @default false
   */
  requireBiometrics?: boolean;

  /**
   * Custom authentication prompt configuration
   */
  authenticationPrompt?: {
    title?: string;
    subtitle?: string;
    description?: string;
    cancel?: string;
  };
}

/**
 * iOS accessibility options
 */
export type SecureAccessible =
  | 'AfterFirstUnlock'
  | 'AfterFirstUnlockThisDeviceOnly'
  | 'WhenUnlocked'
  | 'WhenUnlockedThisDeviceOnly'
  | 'WhenPasscodeSetThisDeviceOnly';

/**
 * Android security levels
 */
export type SecureSecurityLevel =
  | 'ANY'
  | 'SECURE_SOFTWARE'
  | 'SECURE_HARDWARE';

/**
 * Biometry types supported by the device
 */
export type BiometryType =
  | 'TouchID'
  | 'FaceID'
  | 'Fingerprint'
  | 'Face'
  | 'Iris'
  | null;

/**
 * Result from secure storage operations
 */
export interface SecureResult {
  success: boolean;
  error?: string;
}

/**
 * Credentials returned from getSecure
 */
export interface SecureCredentials {
  username: string;
  password: string;
  service: string;
}

// Lazy-loaded keychain module
let Keychain: typeof import('react-native-keychain') | null = null;

/**
 * Check if react-native-keychain is available
 */
function getKeychain(): typeof import('react-native-keychain') {
  if (Keychain === null) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      Keychain = require('react-native-keychain');
    } catch {
      throw new Error(
        '[SAM] react-native-keychain is not installed. ' +
          'Install it with: npm install react-native-keychain'
      );
    }
  }
  return Keychain!;
}

/**
 * Map our accessible options to keychain constants
 */
function mapAccessible(
  accessible: SecureAccessible | undefined,
  keychain: typeof import('react-native-keychain')
): (typeof keychain.ACCESSIBLE)[keyof typeof keychain.ACCESSIBLE] | undefined {
  if (!accessible) return undefined;

  const map = {
    AfterFirstUnlock: keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
    AfterFirstUnlockThisDeviceOnly:
      keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    WhenUnlocked: keychain.ACCESSIBLE.WHEN_UNLOCKED,
    WhenUnlockedThisDeviceOnly:
      keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    WhenPasscodeSetThisDeviceOnly:
      keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  } as const;

  return map[accessible];
}

/**
 * Map our security level options to keychain constants
 */
function mapSecurityLevel(
  level: SecureSecurityLevel | undefined,
  keychain: typeof import('react-native-keychain')
): (typeof keychain.SECURITY_LEVEL)[keyof typeof keychain.SECURITY_LEVEL] | undefined {
  if (!level) return undefined;

  const map = {
    ANY: keychain.SECURITY_LEVEL.ANY,
    SECURE_SOFTWARE: keychain.SECURITY_LEVEL.SECURE_SOFTWARE,
    SECURE_HARDWARE: keychain.SECURITY_LEVEL.SECURE_HARDWARE,
  } as const;

  return map[level];
}

/**
 * Build keychain options from our options
 */
function buildKeychainOptions(
  options: SecureStorageOptions | undefined,
  keychain: typeof import('react-native-keychain')
): Record<string, unknown> {
  const opts: Record<string, unknown> = {
    service: options?.service ?? 'sam-secure',
  };

  if (options?.accessible) {
    opts.accessible = mapAccessible(options.accessible, keychain);
  }

  if (options?.securityLevel) {
    opts.securityLevel = mapSecurityLevel(options.securityLevel, keychain);
  }

  if (options?.requireBiometrics) {
    opts.accessControl = keychain.ACCESS_CONTROL.BIOMETRY_ANY;
  }

  if (options?.authenticationPrompt) {
    opts.authenticationPrompt = options.authenticationPrompt;
  }

  return opts;
}

/**
 * SecureStorage API
 *
 * Provides methods for securely storing and retrieving sensitive data
 * using the device's native secure storage (iOS Keychain / Android Keystore).
 */
export const SecureStorage = {
  /**
   * Check if secure storage is available (react-native-keychain installed)
   */
  isAvailable(): boolean {
    try {
      getKeychain();
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Get the biometry type supported by the device
   *
   * @returns The biometry type or null if not supported
   *
   * @example
   * ```typescript
   * const biometry = await SecureStorage.getSupportedBiometryType();
   * if (biometry === 'FaceID') {
   *   console.log('Face ID is available');
   * }
   * ```
   */
  async getSupportedBiometryType(): Promise<BiometryType> {
    const keychain = getKeychain();
    const type = await keychain.getSupportedBiometryType();
    return type as BiometryType;
  },

  /**
   * Store a value securely
   *
   * @param key The key to store the value under (stored as "username")
   * @param value The value to store (stored as "password")
   * @param options Storage options
   * @returns Result indicating success or failure
   *
   * @example
   * ```typescript
   * // Store an auth token
   * await SecureStorage.set('authToken', 'eyJhbGciOiJIUzI1NiIs...');
   *
   * // Store with biometric protection
   * await SecureStorage.set('bankingToken', 'secret', {
   *   requireBiometrics: true,
   *   authenticationPrompt: { title: 'Authenticate to access banking' }
   * });
   *
   * // Store in a specific service namespace
   * await SecureStorage.set('apiKey', 'key123', { service: 'my-app-api' });
   * ```
   */
  async set(
    key: string,
    value: string,
    options?: SecureStorageOptions
  ): Promise<SecureResult> {
    try {
      const keychain = getKeychain();
      const keychainOptions = buildKeychainOptions(options, keychain);

      const result = await keychain.setGenericPassword(
        key,
        value,
        keychainOptions
      );

      if (result === false) {
        return { success: false, error: 'Failed to store secure value' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Retrieve a securely stored value
   *
   * @param options Storage options (must match options used when storing)
   * @returns The stored credentials or null if not found
   *
   * @example
   * ```typescript
   * const credentials = await SecureStorage.get();
   * if (credentials) {
   *   console.log('Key:', credentials.username);
   *   console.log('Value:', credentials.password);
   * }
   *
   * // Get from specific service
   * const apiCreds = await SecureStorage.get({ service: 'my-app-api' });
   * ```
   */
  async get(options?: SecureStorageOptions): Promise<SecureCredentials | null> {
    try {
      const keychain = getKeychain();
      const keychainOptions = buildKeychainOptions(options, keychain);

      const result = await keychain.getGenericPassword(keychainOptions);

      if (result === false) {
        return null;
      }

      return {
        username: result.username,
        password: result.password,
        service: result.service,
      };
    } catch {
      return null;
    }
  },

  /**
   * Check if a secure value exists
   *
   * @param options Storage options
   * @returns True if a value exists
   *
   * @example
   * ```typescript
   * const hasToken = await SecureStorage.has({ service: 'auth' });
   * ```
   */
  async has(options?: SecureStorageOptions): Promise<boolean> {
    try {
      const keychain = getKeychain();
      const keychainOptions = buildKeychainOptions(options, keychain);
      return await keychain.hasGenericPassword(keychainOptions);
    } catch {
      return false;
    }
  },

  /**
   * Delete a securely stored value
   *
   * @param options Storage options (must match options used when storing)
   * @returns Result indicating success or failure
   *
   * @example
   * ```typescript
   * await SecureStorage.delete({ service: 'auth' });
   * ```
   */
  async delete(options?: SecureStorageOptions): Promise<SecureResult> {
    try {
      const keychain = getKeychain();
      const keychainOptions = buildKeychainOptions(options, keychain);

      const result = await keychain.resetGenericPassword(keychainOptions);

      if (result === false) {
        return { success: false, error: 'Failed to delete secure value' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Get all service names that have stored credentials
   *
   * @returns Array of service names
   *
   * @example
   * ```typescript
   * const services = await SecureStorage.getAllServices();
   * // ['sam-secure', 'auth', 'api-keys']
   * ```
   */
  async getAllServices(): Promise<string[]> {
    try {
      const keychain = getKeychain();
      const services = await keychain.getAllGenericPasswordServices();
      return services;
    } catch {
      return [];
    }
  },

  /**
   * Store internet credentials (for web services)
   *
   * @param server The server URL/domain
   * @param username The username
   * @param password The password
   * @param options Storage options
   * @returns Result indicating success or failure
   *
   * @example
   * ```typescript
   * await SecureStorage.setInternetCredentials(
   *   'https://api.example.com',
   *   'user@example.com',
   *   'password123'
   * );
   * ```
   */
  async setInternetCredentials(
    server: string,
    username: string,
    password: string,
    options?: SecureStorageOptions
  ): Promise<SecureResult> {
    try {
      const keychain = getKeychain();
      const keychainOptions = buildKeychainOptions(options, keychain);

      const result = await keychain.setInternetCredentials(
        server,
        username,
        password,
        keychainOptions
      );

      if (result === false) {
        return { success: false, error: 'Failed to store internet credentials' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Get internet credentials for a server
   *
   * @param server The server URL/domain
   * @param options Storage options
   * @returns The stored credentials or null if not found
   *
   * @example
   * ```typescript
   * const creds = await SecureStorage.getInternetCredentials('https://api.example.com');
   * if (creds) {
   *   console.log('Username:', creds.username);
   * }
   * ```
   */
  async getInternetCredentials(
    server: string,
    options?: SecureStorageOptions
  ): Promise<SecureCredentials | null> {
    try {
      const keychain = getKeychain();
      const keychainOptions = buildKeychainOptions(options, keychain);

      const result = await keychain.getInternetCredentials(
        server,
        keychainOptions
      );

      if (result === false) {
        return null;
      }

      return {
        username: result.username,
        password: result.password,
        service: server,
      };
    } catch {
      return null;
    }
  },

  /**
   * Delete internet credentials for a server
   *
   * @param server The server URL/domain
   * @param options Storage options
   * @returns Result indicating success or failure
   */
  async deleteInternetCredentials(
    server: string,
    _options?: SecureStorageOptions
  ): Promise<SecureResult> {
    try {
      const keychain = getKeychain();
      // resetInternetCredentials only takes server parameter
      await keychain.resetInternetCredentials(server);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};
