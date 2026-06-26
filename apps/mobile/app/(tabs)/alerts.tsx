import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '../services/api';
import { casaWs } from '../services/websocket';
import type { Alert, WsEvent } from '@casa/shared';

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.alerts.list({ acknowledged: false }).then((res) => {
      if (res.success) setAlerts(res.data as Alert[]);
      setLoading(false);
    });

    const unsub = casaWs.subscribe((event: WsEvent) => {
      if (event.type === 'alert_created') {
        setAlerts((prev) => [event.payload as Alert, ...prev]);
      }
    });

    return unsub;
  }, []);

  const acknowledge = async (id: string) => {
    await api.alerts.acknowledge(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  if (loading) return <ActivityIndicator style={styles.loader} color="#3b82f6" />;

  return (
    <FlatList
      style={styles.container}
      data={alerts}
      keyExtractor={(a) => a.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={[styles.card, item.severity === 'critical' && styles.cardCritical]}>
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <TouchableOpacity onPress={() => acknowledge(item.id)}>
              <Text style={styles.dismiss}>Dismiss</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.cardMsg}>{item.message}</Text>
          <Text style={styles.cardTime}>{new Date(item.createdAt).toLocaleString()}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No active alerts. All clear!</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  list: { padding: 16 },
  loader: { flex: 1 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardCritical: { borderLeftWidth: 3, borderLeftColor: '#ef4444' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#f8fafc', flex: 1 },
  cardMsg: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  cardTime: { fontSize: 11, color: '#475569', marginTop: 6 },
  dismiss: { fontSize: 13, color: '#3b82f6' },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 48 },
});
