import { useState, useCallback, useEffect } from 'react';
import { safeJsonParse, safeJsonStringify } from '../utils/serialization';

export interface UseLocalStorageOptions<T> {
  serializer?: (value: T) => string;
  deserializer?: (value: string) => T;
  onError?: (error: Error) => void;
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions<T> = {}
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const {
    serializer = safeJsonStringify,
    deserializer = (v) => safeJsonParse<T>(v, initialValue),
    onError
  } = options;

  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? deserializer(item) : initialValue;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      onError?.(errorObj);
      return initialValue;
    }
  }, [key, initialValue, deserializer, onError]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    if (typeof window === 'undefined') {
      console.warn(`Cannot set localStorage key "${key}" in non-browser environment`);
      return;
    }

    try {
      const newValue = value instanceof Function ? value(storedValue) : value;
      window.localStorage.setItem(key, serializer(newValue));
      setStoredValue(newValue);
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: serializer(newValue) }));
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      onError?.(errorObj);
    }
  }, [key, storedValue, serializer, onError]);

  const removeValue = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: null }));
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      onError?.(errorObj);
    }
  }, [key, initialValue, onError]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        setStoredValue(deserializer(event.newValue));
      } else if (event.key === key && event.newValue === null) {
        setStoredValue(initialValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, initialValue, deserializer]);

  return [storedValue, setValue, removeValue];
}

export interface UseSessionStorageOptions<T> extends UseLocalStorageOptions<T> {}

export function useSessionStorage<T>(
  key: string,
  initialValue: T,
  options: UseSessionStorageOptions<T> = {}
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const {
    serializer = safeJsonStringify,
    deserializer = (v) => safeJsonParse<T>(v, initialValue),
    onError
  } = options;

  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.sessionStorage.getItem(key);
      return item !== null ? deserializer(item) : initialValue;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      onError?.(errorObj);
      return initialValue;
    }
  }, [key, initialValue, deserializer, onError]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const newValue = value instanceof Function ? value(storedValue) : value;
      window.sessionStorage.setItem(key, serializer(newValue));
      setStoredValue(newValue);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      onError?.(errorObj);
    }
  }, [key, storedValue, serializer, onError]);

  const removeValue = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.sessionStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      onError?.(errorObj);
    }
  }, [key, initialValue, onError]);

  return [storedValue, setValue, removeValue];
}
