/**
 * Booking layout — stack for slot picker + confirmation.
 */

import { Stack } from 'expo-router';

export default function BookingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[doctorId]" />
      <Stack.Screen name="confirmation" />
    </Stack>
  );
}
