import { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';

const STORAGE_KEY = 'immersphere:leadsLastSeenCount';
const LEADS_SEEN_EVENT = 'leads:seen';
const POLL_MS = 60_000;

function readSeenCount(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const n = parseInt(raw ?? '0', 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function markLeadsAsSeen(count: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(count));
    window.dispatchEvent(new Event(LEADS_SEEN_EVENT));
  } catch {
    // ignore storage quota errors
  }
}

interface LeadsBadge {
  unreadCount: number;
  totalCount: number;
}

export function useLeadsBadge(enabled: boolean): LeadsBadge {
  const [totalCount, setTotalCount] = useState(0);
  const [seenCount, setSeenCount] = useState(readSeenCount);

  const fetchCount = useCallback(async () => {
    try {
      const res = await api.get('/leads/count');
      const count = (res.data as { data: { count: number } }).data?.count ?? 0;
      setTotalCount(count);
    } catch {
      // silently skip — a missing badge never breaks the app
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    void fetchCount();
    let timer = setInterval(() => { void fetchCount(); }, POLL_MS);

    function onVisibilityChange(): void {
      if (document.hidden) {
        clearInterval(timer);
      } else {
        void fetchCount();
        timer = setInterval(() => { void fetchCount(); }, POLL_MS);
      }
    }

    function onLeadsSeen(): void {
      setSeenCount(readSeenCount());
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener(LEADS_SEEN_EVENT, onLeadsSeen);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener(LEADS_SEEN_EVENT, onLeadsSeen);
    };
  }, [enabled, fetchCount]);

  return {
    unreadCount: Math.max(0, totalCount - seenCount),
    totalCount,
  };
}
