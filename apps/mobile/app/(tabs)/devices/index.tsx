import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Switch, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../services/api';
import { casaWs } from '../../services/websocket';
import PlaceLightModal from '../../components/PlaceLightModal';
import type { Device, WsEvent, FloorLight, RoomWithLights, TuyaSyncResult } from '@casa/shared';

export default function DevicesScreen() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [lights, setLights] = useState<FloorLight[]>([]);
  const [rooms, setRooms] = useState<RoomWithLights[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchAll = useCallback(async () => {
    const [devicesRes, lightsRes, roomsRes] = await Promise.all([
      api.devices.list(),
      api.floor.listLights(),
      api.rooms.list(),
    ]);
    if (devicesRes.success) setDevices(devicesRes.data as Device[]);
    if (lightsRes.success) setLights(lightsRes.data as FloorLight[]);
    if (roomsRes.success) setRooms(roomsRes.data as RoomWithLights[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  useEffect(() => {
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

  const toggleLight = async (light: FloorLight) => {
    const newValue = !light.isOn;
    setLights((prev) => prev.map((l) => l.id === light.id ? { ...l, isOn: newValue } : l));
    await api.floor.toggleLight(light.id, newValue);
  };

  const handleAssignRoom = (light: FloorLight) => {
    Alert.alert(
      `Assign "${light.name}" to`,
      undefined,
      [
        {
          text: 'No room', onPress: async () => {
            await api.floor.updateLight(light.id, { roomId: null });
            setLights((prev) => prev.map((l) => l.id === light.id ? { ...l, roomId: null } : l));
          },
        },
        ...rooms.map((room) => ({
          text: room.name,
          onPress: async () => {
            await api.floor.updateLight(light.id, { roomId: room.id });
            setLights((prev) => prev.map((l) => l.id === light.id ? { ...l, roomId: room.id } : l));
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  const handleLightLongPress = (light: FloorLight) => {
    Alert.alert(light.name, 'What do you want to do?', [
      { text: 'Assign room', onPress: () => handleAssignRoom(light) },
      {
        text: 'Unlink light', style: 'destructive', onPress: async () => {
          await api.floor.removeLight(light.id);
          setLights((prev) => prev.filter((l) => l.id !== light.id));
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSync = async () => {
    setSyncing(true);
    const res = await api.tuya.sync();
    if (res.success) {
      const { linked, roomsCreated, skipped } = res.data as TuyaSyncResult;
      await fetchAll();
      Alert.alert(
        'Sync complete',
        `Linked ${linked} light${linked !== 1 ? 's' : ''} into ${roomsCreated} new room${roomsCreated !== 1 ? 's' : ''}` +
          (skipped > 0 ? ` (${skipped} already linked)` : ''),
      );
    } else {
      Alert.alert('Sync failed', res.error?.message ?? 'Could not sync devices from Tuya');
    }
    setSyncing(false);
  };

  const handleLinkConfirm = async (name: string, deviceId: string, roomId: string | null) => {
    setShowLinkModal(false);
    const res = await api.floor.placeLight({ name, tuyaDeviceId: deviceId, roomId });
    if (res.success) setLights((prev) => [...prev, res.data as FloorLight]);
  };

  const roomName = (roomId?: string | null) => rooms.find((r) => r.id === roomId)?.name;

  const sortedLights = [...lights].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  if (loading) return <ActivityIndicator style={styles.loader} color="#3b82f6" />;

  return (
    <>
      <FlatList
        style={styles.container}
        data={devices}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.lightsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Lights</Text>
              <View style={styles.headerBtns}>
                <TouchableOpacity style={[styles.linkBtn, styles.syncBtn]} onPress={handleSync} disabled={syncing}>
                  {syncing ? <ActivityIndicator size="small" color="#f8fafc" /> : <Text style={styles.linkBtnText}>Sync from Tuya</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.linkBtn} onPress={() => setShowLinkModal(true)}>
                  <Text style={styles.linkBtnText}>+ Link Light</Text>
                </TouchableOpacity>
              </View>
            </View>

            {lights.length > 0 && <Text style={styles.hint}>Long-press a light to assign a room or unlink it</Text>}

            {lights.length === 0 ? (
              <Text style={styles.empty}>
                No lights linked yet. Tap "+ Link Light" to pull in a bulb from your SmartLife account.
              </Text>
            ) : (
              sortedLights.map((light) => (
                <TouchableOpacity
                  key={light.id}
                  style={styles.card}
                  activeOpacity={0.8}
                  onLongPress={() => handleLightLongPress(light)}
                >
                  <View style={styles.cardRow}>
                    <View>
                      <Text style={styles.cardTitle}>{light.name}</Text>
                      <Text style={styles.cardSub}>{roomName(light.roomId) ?? 'No room'}</Text>
                    </View>
                    <Switch
                      value={light.isOn}
                      onValueChange={() => toggleLight(light)}
                      trackColor={{ true: '#3b82f6', false: '#334155' }}
                      thumbColor="#f8fafc"
                    />
                  </View>
                </TouchableOpacity>
              ))
            )}

            {devices.length > 0 && <Text style={styles.sectionTitle}>Other Devices</Text>}
          </View>
        }
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
      />

      <PlaceLightModal
        visible={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onConfirm={handleLinkConfirm}
        title="Link Light"
        confirmLabel="Link"
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  list: { padding: 16 },
  loader: { flex: 1, backgroundColor: '#0f172a' },
  lightsSection: { marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginTop: 8, marginBottom: 12 },
  headerBtns: { flexDirection: 'row', gap: 8 },
  linkBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#3b82f6', minWidth: 40, alignItems: 'center' },
  syncBtn: { backgroundColor: '#1e293b' },
  linkBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#f8fafc' },
  cardSub: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOnline: { backgroundColor: '#22c55e' },
  dotOffline: { backgroundColor: '#ef4444' },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 12, marginBottom: 16, fontSize: 13, lineHeight: 20, paddingHorizontal: 8 },
  hint: { color: '#64748b', fontSize: 12, marginTop: -6, marginBottom: 10 },
});
