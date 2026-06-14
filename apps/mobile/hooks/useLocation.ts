/**
 * useLocation Hook — requests location permission and returns current coordinates.
 * Uses expo-location for both patient and doctor ICU screens.
 */

import { useState, useEffect, useCallback } from 'react';
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

  const requestPermission = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setError('PERMISSION_DENIED');
        setLoading(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'LOCATION_ERROR');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  return { location, loading, error, requestPermission };
}
