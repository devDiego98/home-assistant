import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../services/api';
import type { Camera } from '@casa/shared';

export default function CamerasScreen() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.cameras.list().then((res) => {
      if (res.success) setCameras(res.data as Camera[]);
      setLoading(false);
    });
  }, []);

  if (loading) return <ActivityIndicator style={styles.loader} color="#3b82f6" />;

  return (
    <FlatList
      style={styles.container}
      data={cameras}
      keyExtractor={(c) => c.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => router.push(`/cameras/${item.id}`)}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <View style={[styles.badge, item.status === 'online' ? styles.badgeOnline : styles.badgeOffline]}>
              <Text style={styles.badgeText}>{item.status}</Text>
            </View>
          </View>
          <Text style={styles.cardSub}>{item.location}</Text>
          <Text style={styles.cardRes}>{item.resolutionWidth}×{item.resolutionHeight}</Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No cameras configured yet.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  list: { padding: 16 },
  loader: { flex: 1 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#f8fafc' },
  cardSub: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  cardRes: { fontSize: 12, color: '#475569', marginTop: 2 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeOnline: { backgroundColor: '#064e3b' },
  badgeOffline: { backgroundColor: '#3b1414' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#f8fafc' },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 48 },
});
