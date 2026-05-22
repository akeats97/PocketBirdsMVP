import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'dex.wishlist.v1';

interface WishlistContextValue {
  wishlist: Set<string>;
  toggle: (name: string) => void;
  isReady: boolean;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setWishlist(new Set(parsed.filter((x) => typeof x === 'string')));
          }
        }
      } catch (err) {
        console.log('[WishlistContext] failed to load:', err);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const persist = useCallback(async (set: Set<string>) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
    } catch (err) {
      console.log('[WishlistContext] failed to persist:', err);
    }
  }, []);

  const toggle = useCallback(
    (name: string) => {
      setWishlist((prev) => {
        const next = new Set(prev);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return (
    <WishlistContext.Provider value={{ wishlist, toggle, isReady }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider');
  return ctx;
}
