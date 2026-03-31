'use client';

import { useEffect, useRef } from 'react';
import { useBuilderStore } from '../../store/venueBuilderStore';

const AUTOSAVE_INTERVAL = 30_000; // 30 seconds

export function useAutosave(onSave: (silent: boolean) => void) {
  const is_dirty = useBuilderStore((s) => s.is_dirty);
  const dirtyRef = useRef(is_dirty);

  useEffect(() => {
    dirtyRef.current = is_dirty;
  }, [is_dirty]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (dirtyRef.current) {
        onSave(true);
      }
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [onSave]);
}
