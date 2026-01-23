import { useCallback, useState } from 'react';

type AsyncFn<TArgs extends any[], TResult> = (...args: TArgs) => Promise<TResult>;

export const useAsyncAction = <TArgs extends any[], TResult>(fn: AsyncFn<TArgs, TResult>) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: TArgs) => {
      setLoading(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (err: any) {
        const message = err?.message || 'Terjadi kesalahan';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fn]
  );

  return { run, loading, error, resetError: () => setError(null) };
};
