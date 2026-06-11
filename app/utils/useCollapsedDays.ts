import { useCallback, useState } from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';

// LayoutAnimation needs an explicit opt-in on Android (old architecture).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Collapse state for day-grouped journals: a set of collapsed section keys
// (the YYYY-MM-DD key from groupSightingsByDay). Session-only by design — a
// fresh open starts fully expanded. Toggling animates the rows in/out.
export function useCollapsedDays() {
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  const toggleDay = useCallback((key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(200, 'easeInEaseOut', 'opacity'));
    setCollapsedDays(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return { collapsedDays, toggleDay };
}

// Non-route file under app/ — default export silences the expo-router warning.
export default useCollapsedDays;
