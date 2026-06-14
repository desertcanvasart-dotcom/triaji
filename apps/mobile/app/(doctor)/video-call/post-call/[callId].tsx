/**
 * Doctor Post-Call Screen — renders the full PostCallForm component.
 * Pre-loads in-call notes from gp_video_calls.structured_notes_ar.
 */

import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useLang } from '@/hooks/useLang';
import PostCallForm from '@/components/post-call/PostCallForm';

export default function PostCallScreen() {
  const { callId } = useLocalSearchParams<{ callId: string }>();
  const { lang } = useLang();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: '',
          headerStyle: { backgroundColor: '#F5F5F5' },
          headerShadowVisible: false,
        }}
      />
      <PostCallForm callId={callId ?? ''} lang={lang} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
});
