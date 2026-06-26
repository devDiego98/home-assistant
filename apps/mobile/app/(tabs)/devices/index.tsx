import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Switch, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '../../services/api';
import { casaWs } from '../../services/websocket';
import type { Device, WsEvent } from '@casa/shared';

export default function DevicesScreen() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.devices.list().then((res) => {
      if (res.success) setDevices(res.data as Device[]);
      setLoading(false);
    });

    const unsub = casaWs.subscribe((event: WsEvent) => {
      if (event.type === 'device_state_changed') {
        const { deviceId, state } = event.payload as { deviceId: string; state: Device['state'] };
        setDevices((prev) => prev.map((d) => d.id === deviceId ? { ...d, state } : d));
      }
    });

    return unsub;
  }, []);

  const togglePower = async (device: Device) => {
    const newValue = !device.state.power;
    setDevices((prev) => prev.map((d) => d.id === device.id ? { ...d, state: { ...d.state, power: newValue } } : d));
    await api.devices.command(device.id, 'on_off', newValue);
  };

  if (loading) return <ActivityIndicator style={styles.loader} color="#3b82f6" />;

  return (
    <FlatList
      style={styles.container}
      data={devices}
      keyExtractor={(d) => d.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardSub}>{item.room ?? 'No room'} · {item.type}</Text>
            </View>
            {item.capabilities.on_off ? (
              <Switch
                value={item.state.power ?? false}
                onValueChange={() => togglePower(item)}
                trackColor={{ true: '#3b82f6', false: '#334155' }}
                thumbColor="#f8fafc"
              />
            ) : (
              <View style={[styles.dot, item.status === 'online' ? styles.dotOnline : styles.dotOffline]} />
            )}
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No devices found.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  list: { padding: 16 },
  loader: { flex: 1 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#f8fafc' },
  cardSub: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOnline: { backgroundColor: '#22c55e' },
  dotOffline: { backgroundColor: '#ef4444' },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 48 },
});
