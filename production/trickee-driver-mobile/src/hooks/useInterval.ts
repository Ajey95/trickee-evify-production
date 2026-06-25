import {useEffect, useRef} from 'react';

/**
 * Declarative setInterval. Pass `delay = null` to pause. The latest `callback`
 * is always invoked without resetting the timer (avoids the stale-closure and
 * timer-thrash bugs of putting the callback in a useEffect dependency array).
 */
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) {
      return undefined;
    }
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
