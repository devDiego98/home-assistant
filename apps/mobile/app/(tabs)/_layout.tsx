import { Tabs } from 'expo-router';
import { useAuthStore } from '../store/auth';
import { Redirect } from 'expo-router';

export default function TabsLayout() {
  const { user, isLoading } = useAuthStore();

  if (!isLoading && !user) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#1e293b' },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#64748b',
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#f8fafc',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="cameras/index" options={{ title: 'Cameras' }} />
      <Tabs.Screen name="devices/index" options={{ title: 'Devices' }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts' }} />
    </Tabs>
  );
}
