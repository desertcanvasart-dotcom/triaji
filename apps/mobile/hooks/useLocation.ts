/**
 * useLocation Hook — requests location permission and returns current coordinates.
 * Uses expo-location for both patient and doctor ICU screens.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';

interface LocationCoords {
  lat: number;
  lng: number;
}

interface UseLocationResult {
  location: LocationCoords | null;
  loading: boolean;
  error: string | null;
  requestPermission: () => Promise<void>;
}

export function useLocation(): UseLocationResult {
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The permission/GPS prompt can still be pending when the screen unmounts
  // (e.g. navigating away). Guard the setters so we don't setState on an
  // unmounted component.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const requestPermission = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        if (mountedRef.current) {
          setError('PERMISSION_DENIED');
          setLoading(false);
        }
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (mountedRef.current) {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'LOCATION_ERROR');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  return { location, loading, error, requestPermission };
}
