import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from './store/auth';
import { casaWs } from './services/websocket';

export default function RootLayout() {
  const { loadPersistedAuth, user } = useAuthStore();

  useEffect(() => {
    loadPersistedAuth();
  }, []);

  useEffect(() => {
    if (user) {
      casaWs.connect();
      return () => casaWs.disconnect();
    }
  }, [user]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f8fafc',
          contentStyle: { backgroundColor: '#0f172a' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
