/**
 * Doctor Tab Navigator — Dashboard, Patients, ICU, Profile.
 * Hidden screens: login, register, consultation, referrals, follow-ups, patient detail.
 */

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLang } from '@/hooks/useLang';
import { s } from '@triaji/shared/i18n';

export default function DoctorTabLayout() {
  const { lang } = useLang();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1A2F4A',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E0E0E0',
          paddingBottom: 8,
          paddingTop: 8,
          height: 80,
        },
        tabBarLabelStyle: {
          fontFamily: 'Cairo',
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: s.tabs.dashboard[lang],
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="patients/index"
        options={{
          title: s.tabs.patients[lang],
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="icu"
        options={{
          title: s.tabs.icuTab[lang],
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pulse-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: s.tabs.profile[lang],
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Hidden screens from tab bar */}
      <Tabs.Screen
        name="login"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="register"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="consultation/[bookingId]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="patients/[patientId]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="referrals"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="follow-ups"
        options={{ href: null }}
      />
    </Tabs>
  );
}
