/**
 * S.A.M - useSecure Hook
 *
 * React hook for secure storage operations using react-native-keychain.
 * Provides a simple API for storing and retrieving sensitive data like
 * auth tokens, credentials, and other secrets.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  SecureStorage,
  type SecureStorageOptions,
  type SecureCredentials,
  type BiometryType,
} from './secure';

/**
 * Configuration for useSecure hook
 */
export interface UseSecureConfig {
  /**
   * Service name for the keychain item (acts as a namespace)
   * @default 'sam-secure'
   */
  service?: string;

  /**
   * iOS: When the keychain item is accessible
   * @default 'AfterFirstUnlock'
   */
  accessible?: SecureStorageOptions['accessible'];

  /**
   * Android: Security level for the keychain item
   */
  securityLevel?: SecureStorageOptions['securityLevel'];

  /**
   * Enable biometric authentication for accessing the item
   * @default false
   */
  requireBiometrics?: boolean;

  /**
   * Custom authentication prompt configuration
   */
  authenticationPrompt?: SecureStorageOptions['authenticationPrompt'];

  /**
   * Automatically load the stored value on mount
   * @default true
   */
  autoLoad?: boolean;
}

/**
 * Result from useSecure hook
 */
export interface UseSecureResult {
  /** The stored key (username) */
  key: string | null;

  /** The stored value (password) */
  value: string | null;

  /** Whether the hook is currently loading */
  isLoading: boolean;

  /** Error message if an operation failed */
  error: string | null;

  /** Whether secure storage is available */
  isAvailable: boolean;

  /** The biometry type supported by the device */
  biometryType: BiometryType;

  /** Store a value securely */
  set: (key: string, value: string) => Promise<boolean>;

  /** Retrieve the stored value */
  get: () => Promise<SecureCredentials | null>;

  /** Check if a value exists */
  has: () => Promise<boolean>;

  /** Delete the stored value */
  remove: () => Promise<boolean>;

  /** Refresh the stored value from secure storage */
  refresh: () => Promise<void>;
}

/**
 * Hook for secure storage operations
 *
 * Uses react-native-keychain to securely store sensitive data like
 * auth tokens, passwords, and other secrets in the device's native
 * secure storage (iOS Keychain / Android Keystore).
 *
 * @param config Configuration options
 * @returns Secure storage state and operations
 *
 * @example
 * ```tsx
 * function AuthProvider({ children }) {
 *   const {
 *     value: token,
 *     set,
 *     remove,
 *     isLoading,
 *     biometryType
 *   } = useSecure({
 *     service: 'auth-token',
 *     requireBiometrics: true,
 *   });
 *
 *   const login = async (newToken: string) => {
 *     await set('token', newToken);
 *   };
 *
 *   const logout = async () => {
 *     await remove();
 *   };
 *
 *   if (isLoading) return <Loading />;
 *
 *   return (
 *     <AuthContext.Provider value={{ token, login, logout, biometryType }}>
 *       {children}
 *     </AuthContext.Provider>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Store API credentials with custom service
 * function ApiKeyManager() {
 *   const { value: apiKey, set, remove, has } = useSecure({
 *     service: 'api-credentials',
 *     accessible: 'WhenUnlocked',
 *   });
 *
 *   return (
 *     <View>
 *       <Text>API Key: {apiKey ? '••••••••' : 'Not set'}</Text>
 *       <Button
 *         title="Set API Key"
 *         onPress={() => set('apiKey', 'sk_live_xxx')}
 *       />
 *       <Button title="Clear" onPress={remove} />
 *     </View>
 *   );
 * }
 * ```
 */
export function useSecure(config: UseSecureConfig = {}): UseSecureResult {
  const {
    service = 'sam-secure',
    accessible,
    securityLevel,
    requireBiometrics = false,
    authenticationPrompt,
    autoLoad = true,
  } = config;

  const [key, setKey] = useState<string | null>(null);
  const [value, setValue] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(autoLoad);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometryType, setBiometryType] = useState<BiometryType>(null);

  const mountedRef = useRef(true);

  // Build options object
  const options: SecureStorageOptions = {
    service,
    accessible,
    securityLevel,
    requireBiometrics,
    authenticationPrompt,
  };

  // Check availability and load initial value
  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      // Check if keychain is available
      const available = SecureStorage.isAvailable();
      if (mountedRef.current) {
        setIsAvailable(available);
      }

      if (!available) {
        if (mountedRef.current) {
          setIsLoading(false);
          setError('react-native-keychain is not installed');
        }
        return;
      }

      // Get supported biometry type
      try {
        const biometry = await SecureStorage.getSupportedBiometryType();
        if (mountedRef.current) {
          setBiometryType(biometry);
        }
      } catch {
        // Biometry check failed, continue without it
      }

      // Auto-load stored value
      if (autoLoad) {
        try {
          const credentials = await SecureStorage.get(options);
          if (mountedRef.current) {
            if (credentials) {
              setKey(credentials.username);
              setValue(credentials.password);
            }
            setIsLoading(false);
          }
        } catch (err) {
          if (mountedRef.current) {
            setError(err instanceof Error ? err.message : 'Failed to load');
            setIsLoading(false);
          }
        }
      }
    };

    init();

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, autoLoad]);

  /**
   * Store a value securely
   */
  const set = useCallback(
    async (newKey: string, newValue: string): Promise<boolean> => {
      setError(null);
      setIsLoading(true);

      try {
        const result = await SecureStorage.set(newKey, newValue, options);

        if (mountedRef.current) {
          if (result.success) {
            setKey(newKey);
            setValue(newValue);
          } else {
            setError(result.error ?? 'Failed to store');
          }
          setIsLoading(false);
        }

        return result.success;
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to store');
          setIsLoading(false);
        }
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [service, accessible, securityLevel, requireBiometrics]
  );

  /**
   * Retrieve the stored value
   */
  const get = useCallback(async (): Promise<SecureCredentials | null> => {
    setError(null);
    setIsLoading(true);

    try {
      const credentials = await SecureStorage.get(options);

      if (mountedRef.current) {
        if (credentials) {
          setKey(credentials.username);
          setValue(credentials.password);
        }
        setIsLoading(false);
      }

      return credentials;
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to get');
        setIsLoading(false);
      }
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, accessible, securityLevel, requireBiometrics]);

  /**
   * Check if a value exists
   */
  const has = useCallback(async (): Promise<boolean> => {
    try {
      return await SecureStorage.has(options);
    } catch {
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service]);

  /**
   * Delete the stored value
   */
  const remove = useCallback(async (): Promise<boolean> => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await SecureStorage.delete(options);

      if (mountedRef.current) {
        if (result.success) {
          setKey(null);
          setValue(null);
        } else {
          setError(result.error ?? 'Failed to delete');
        }
        setIsLoading(false);
      }

      return result.success;
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to delete');
        setIsLoading(false);
      }
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service]);

  /**
   * Refresh the stored value from secure storage
   */
  const refresh = useCallback(async (): Promise<void> => {
    await get();
  }, [get]);

  return {
    key,
    value,
    isLoading,
    error,
    isAvailable,
    biometryType,
    set,
    get,
    has,
    remove,
    refresh,
  };
}

/**
 * Hook for internet credentials (web service authentication)
 *
 * Stores credentials associated with a specific server/domain.
 *
 * @param server The server URL or domain
 * @param config Configuration options
 *
 * @example
 * ```tsx
 * function ApiAuth() {
 *   const {
 *     username,
 *     password,
 *     set,
 *     remove,
 *   } = useSecureCredentials('https://api.example.com');
 *
 *   const login = async (user: string, pass: string) => {
 *     await set(user, pass);
 *   };
 *
 *   return (
 *     <View>
 *       {username ? (
 *         <Text>Logged in as {username}</Text>
 *       ) : (
 *         <LoginForm onSubmit={login} />
 *       )}
 *     </View>
 *   );
 * }
 * ```
 */
export function useSecureCredentials(
  server: string,
  config: Omit<UseSecureConfig, 'service'> = {}
): {
  username: string | null;
  password: string | null;
  isLoading: boolean;
  error: string | null;
  isAvailable: boolean;
  biometryType: BiometryType;
  set: (username: string, password: string) => Promise<boolean>;
  get: () => Promise<SecureCredentials | null>;
  has: () => Promise<boolean>;
  remove: () => Promise<boolean>;
  refresh: () => Promise<void>;
} {
  const {
    accessible,
    securityLevel,
    requireBiometrics = false,
    authenticationPrompt,
    autoLoad = true,
  } = config;

  const [username, setUsername] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(autoLoad);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometryType, setBiometryType] = useState<BiometryType>(null);

  const mountedRef = useRef(true);

  const options: SecureStorageOptions = {
    accessible,
    securityLevel,
    requireBiometrics,
    authenticationPrompt,
  };

  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      const available = SecureStorage.isAvailable();
      if (mountedRef.current) {
        setIsAvailable(available);
      }

      if (!available) {
        if (mountedRef.current) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const biometry = await SecureStorage.getSupportedBiometryType();
        if (mountedRef.current) {
          setBiometryType(biometry);
        }
      } catch {
        // Continue without biometry
      }

      if (autoLoad) {
        try {
          const credentials = await SecureStorage.getInternetCredentials(
            server,
            options
          );
          if (mountedRef.current) {
            if (credentials) {
              setUsername(credentials.username);
              setPassword(credentials.password);
            }
            setIsLoading(false);
          }
        } catch (err) {
          if (mountedRef.current) {
            setError(err instanceof Error ? err.message : 'Failed to load');
            setIsLoading(false);
          }
        }
      }
    };

    init();

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server, autoLoad]);

  const set = useCallback(
    async (newUsername: string, newPassword: string): Promise<boolean> => {
      setError(null);
      setIsLoading(true);

      try {
        const result = await SecureStorage.setInternetCredentials(
          server,
          newUsername,
          newPassword,
          options
        );

        if (mountedRef.current) {
          if (result.success) {
            setUsername(newUsername);
            setPassword(newPassword);
          } else {
            setError(result.error ?? 'Failed to store');
          }
          setIsLoading(false);
        }

        return result.success;
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to store');
          setIsLoading(false);
        }
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [server, accessible, securityLevel, requireBiometrics]
  );

  const get = useCallback(async (): Promise<SecureCredentials | null> => {
    setError(null);
    setIsLoading(true);

    try {
      const credentials = await SecureStorage.getInternetCredentials(
        server,
        options
      );

      if (mountedRef.current) {
        if (credentials) {
          setUsername(credentials.username);
          setPassword(credentials.password);
        }
        setIsLoading(false);
      }

      return credentials;
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to get');
        setIsLoading(false);
      }
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server, accessible, securityLevel, requireBiometrics]);

  const has = useCallback(async (): Promise<boolean> => {
    try {
      const credentials = await SecureStorage.getInternetCredentials(
        server,
        options
      );
      return credentials !== null;
    } catch {
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server]);

  const remove = useCallback(async (): Promise<boolean> => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await SecureStorage.deleteInternetCredentials(
        server,
        options
      );

      if (mountedRef.current) {
        if (result.success) {
          setUsername(null);
          setPassword(null);
        } else {
          setError(result.error ?? 'Failed to delete');
        }
        setIsLoading(false);
      }

      return result.success;
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to delete');
        setIsLoading(false);
      }
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server]);

  const refresh = useCallback(async (): Promise<void> => {
    await get();
  }, [get]);

  return {
    username,
    password,
    isLoading,
    error,
    isAvailable,
    biometryType,
    set,
    get,
    has,
    remove,
    refresh,
  };
}
