/**
 * Telehealth layout — stack for video call screen.
 */

import { Stack } from 'expo-router';

export default function TelehealthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[bookingId]" />
    </Stack>
  );
}
