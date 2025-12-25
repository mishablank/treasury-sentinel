import { useState, useCallback, useEffect, useRef } from 'react';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export interface UseAsyncOptions<T> {
  immediate?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  initialData?: T | null;
}

export interface UseAsyncReturn<T, P extends unknown[]> extends AsyncState<T> {
  execute: (...params: P) => Promise<T | null>;
  reset: () => void;
  setData: (data: T | null) => void;
}

export function useAsync<T, P extends unknown[] = []>(
  asyncFunction: (...params: P) => Promise<T>,
  options: UseAsyncOptions<T> = {}
): UseAsyncReturn<T, P> {
  const {
    immediate = false,
    onSuccess,
    onError,
    initialData = null
  } = options;

  const [state, setState] = useState<AsyncState<T>>({
    data: initialData,
    loading: immediate,
    error: null
  });

  const mountedRef = useRef(true);
  const asyncFunctionRef = useRef(asyncFunction);

  useEffect(() => {
    asyncFunctionRef.current = asyncFunction;
  }, [asyncFunction]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async (...params: P): Promise<T | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await asyncFunctionRef.current(...params);
      
      if (mountedRef.current) {
        setState({ data: result, loading: false, error: null });
        onSuccess?.(result);
      }
      
      return result;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      
      if (mountedRef.current) {
        setState(prev => ({ ...prev, loading: false, error: errorObj }));
        onError?.(errorObj);
      }
      
      return null;
    }
  }, [onSuccess, onError]);

  const reset = useCallback(() => {
    setState({ data: initialData, loading: false, error: null });
  }, [initialData]);

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  useEffect(() => {
    if (immediate) {
      execute(...([] as unknown as P));
    }
  }, [immediate]);

  return {
    ...state,
    execute,
    reset,
    setData
  };
}

export interface UsePollingOptions<T> extends UseAsyncOptions<T> {
  interval: number;
  enabled?: boolean;
}

export function usePolling<T, P extends unknown[] = []>(
  asyncFunction: (...params: P) => Promise<T>,
  params: P,
  options: UsePollingOptions<T>
): UseAsyncReturn<T, P> {
  const { interval, enabled = true, ...asyncOptions } = options;
  const asyncState = useAsync(asyncFunction, asyncOptions);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    asyncState.execute(...params);

    intervalRef.current = setInterval(() => {
      asyncState.execute(...params);
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, ...params]);

  return asyncState;
}

export interface UseDebouncedAsyncOptions<T> extends UseAsyncOptions<T> {
  delay: number;
}

export function useDebouncedAsync<T, P extends unknown[] = []>(
  asyncFunction: (...params: P) => Promise<T>,
  options: UseDebouncedAsyncOptions<T>
): UseAsyncReturn<T, P> {
  const { delay, ...asyncOptions } = options;
  const asyncState = useAsync(asyncFunction, asyncOptions);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedExecute = useCallback((...params: P): Promise<T | null> => {
    return new Promise((resolve) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(async () => {
        const result = await asyncState.execute(...params);
        resolve(result);
      }, delay);
    });
  }, [delay, asyncState.execute]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    ...asyncState,
    execute: debouncedExecute
  };
}
