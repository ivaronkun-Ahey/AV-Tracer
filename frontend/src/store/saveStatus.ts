import { useSyncExternalStore } from 'react';

/**
 * Состояние автосохранения в браузере. Живёт вне Redux: запись статуса через
 * dispatch снова запускала бы автосохранение.
 */
export type SaveStatus =
  | { state: 'idle' }
  | { state: 'pending' }
  | { state: 'saved'; at: number }
  | { state: 'error'; at: number };

let status: SaveStatus = { state: 'idle' };
const listeners = new Set<() => void>();

export function setSaveStatus(next: SaveStatus) {
  status = next;
  listeners.forEach((l) => l());
}

export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => status
  );
}
