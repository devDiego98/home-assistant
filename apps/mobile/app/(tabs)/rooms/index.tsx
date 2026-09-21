import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Switch, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../services/api';
import ColorPickerModal from '../../components/ColorPickerModal';
import type { RoomWithLights, RoomPreset } from '@casa/shared';

export default function RoomsScreen() {
  const [rooms, setRooms] = useState<RoomWithLights[]>([]);
  const [presets, setPresets] = useState<Record<string, RoomPreset[]>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [busyRoomId, setBusyRoomId] = useState<string | null>(null);
  const [pickerRoomId, setPickerRoomId] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    const res = await api.rooms.list();
    if (res.success) {
      const roomsData = res.data as RoomWithLights[];
      setRooms(roomsData);
      const presetResults = await Promise.all(roomsData.map((r) => api.rooms.presets.list(r.id)));
      const presetMap: Record<string, RoomPreset[]> = {};
      roomsData.forEach((r, i) => {
        const presetRes = presetResults[i];
        presetMap[r.id] = presetRes?.success ? (presetRes.data as RoomPreset[]) : [];
      });
      setPresets(presetMap);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchRooms(); }, [fetchRooms]));

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    const res = await api.rooms.create({ name: newRoomName.trim() });
    if (res.success) setRooms((prev) => [...prev, res.data as RoomWithLights]);
    setNewRoomName('');
    setCreating(false);
  };

  const handleLongPress = (room: RoomWithLights) => {
    Alert.alert(room.name, 'What do you want to do?', [
      {
        text: 'Delete room', style: 'destructive', onPress: async () => {
          await api.rooms.remove(room.id);
          setRooms((prev) => prev.filter((r) => r.id !== room.id));
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleToggleRoom = async (room: RoomWithLights, on: boolean) => {
    setRooms((prev) => prev.map((r) => r.id === room.id
      ? { ...r, lightsOn: on ? r.lightCount : 0, partyActive: on ? r.partyActive : false }
      : r));
    setBusyRoomId(room.id);
    await api.rooms.toggle(room.id, on);
    setBusyRoomId(null);
  };

  const handleWhite = async (room: RoomWithLights) => {
    if (room.lightCount === 0) return;
    setBusyRoomId(room.id);
    await api.rooms.applyWhite(room.id, { brightness: 100, colorTemp: 500 });
    setRooms((prev) => prev.map((r) => r.id === room.id ? { ...r, lightsOn: r.lightCount, partyActive: false } : r));
    setBusyRoomId(null);
  };

  const handleWarm = async (room: RoomWithLights) => {
    if (room.lightCount === 0) return;
    setBusyRoomId(room.id);
    await api.rooms.applyWhite(room.id, { brightness: 100, colorTemp: 0 });
    setRooms((prev) => prev.map((r) => r.id === room.id ? { ...r, lightsOn: r.lightCount, partyActive: false } : r));
    setBusyRoomId(null);
  };

  const handleApplyPreset = async (room: RoomWithLights, preset: RoomPreset) => {
    if (room.lightCount === 0) return;
    setBusyRoomId(room.id);
    await api.rooms.presets.apply(room.id, preset.id);
    setRooms((prev) => prev.map((r) => r.id === room.id ? { ...r, lightsOn: r.lightCount, partyActive: false } : r));
    setBusyRoomId(null);
  };

  const handleDeletePreset = (room: RoomWithLights, preset: RoomPreset) => {
    Alert.alert(`Delete "${preset.name}"?`, undefined, [
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await api.rooms.presets.remove(room.id, preset.id);
          setPresets((prev) => ({ ...prev, [room.id]: (prev[room.id] ?? []).filter((p) => p.id !== preset.id) }));
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handlePickerApplied = async () => {
    const roomId = pickerRoomId;
    if (!roomId) return;
    const [roomsRes, presetsRes] = await Promise.all([api.rooms.list(), api.rooms.presets.list(roomId)]);
    if (roomsRes.success) setRooms(roomsRes.data as RoomWithLights[]);
    if (presetsRes.success) setPresets((prev) => ({ ...prev, [roomId]: presetsRes.data as RoomPreset[] }));
  };

  const handleToggleParty = async (room: RoomWithLights) => {
    if (room.lightCount === 0) return;
    const action = room.partyActive ? 'stop' : 'start';
    setBusyRoomId(room.id);
    const res = await api.rooms.party(room.id, action);
    if (res.success) {
      const partyActive = (res.data as { partyActive: boolean }).partyActive;
      setRooms((prev) => prev.map((r) => r.id === room.id
        ? { ...r, partyActive, lightsOn: partyActive ? r.lightCount : r.lightsOn }
        : r));
    }
    setBusyRoomId(null);
  };

  if (loading) return <ActivityIndicator style={styles.loader} color="#3b82f6" />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Rooms</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setCreating((v) => !v)}>
          <Text style={styles.addBtnText}>{creating ? 'Cancel' : '+ Add Room'}</Text>
        </TouchableOpacity>
      </View>

      {creating && (
        <View style={styles.newRoomRow}>
          <TextInput
            style={styles.newRoomInput}
            placeholder="e.g. Living Room"
            placeholderTextColor="#475569"
            value={newRoomName}
            onChangeText={setNewRoomName}
            autoFocus
          />
          <TouchableOpacity style={styles.newRoomAddBtn} onPress={handleCreateRoom} disabled={!newRoomName.trim()}>
            <Text style={styles.newRoomAddText}>Add</Text>
          </TouchableOpacity>
        </View>
      )}

      {rooms.length === 0 && !creating && (
        <Text style={styles.empty}>
          No rooms yet. Tap "+ Add Room", then assign lights to it from Home → Edit Layout.
        </Text>
      )}

      {rooms.map((room) => (
        <TouchableOpacity
          key={room.id}
          style={styles.card}
          activeOpacity={0.8}
          onLongPress={() => handleLongPress(room)}
        >
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>{room.name}</Text>
              <Text style={styles.cardSub}>
                {room.lightCount === 0
                  ? 'No lights assigned'
                  : `${room.lightsOn}/${room.lightCount} light${room.lightCount !== 1 ? 's' : ''} on`}
              </Text>
            </View>
            <Switch
              value={room.lightsOn > 0}
              onValueChange={(on) => handleToggleRoom(room, on)}
              disabled={room.lightCount === 0 || busyRoomId === room.id}
              trackColor={{ true: '#3b82f6', false: '#334155' }}
              thumbColor="#f8fafc"
            />
          </View>

          <View style={styles.sceneRow}>
            <TouchableOpacity
              style={[styles.sceneBtn, styles.whiteBtn]}
              onPress={() => handleWhite(room)}
              disabled={room.lightCount === 0 || busyRoomId === room.id}
            >
              <Text style={styles.sceneBtnText}>☀️ White</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sceneBtn, styles.warmBtn]}
              onPress={() => handleWarm(room)}
              disabled={room.lightCount === 0 || busyRoomId === room.id}
            >
              <Text style={styles.sceneBtnText}>🕯️ Warm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sceneBtn, room.partyActive ? styles.partyBtnActive : styles.partyBtn]}
              onPress={() => handleToggleParty(room)}
              disabled={room.lightCount === 0 || busyRoomId === room.id}
            >
              <Text style={styles.sceneBtnText}>{room.partyActive ? '⏹ Stop' : '🎉 Party'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.sceneBtn, styles.customBtn, styles.customBtnRow]}
            onPress={() => setPickerRoomId(room.id)}
            disabled={room.lightCount === 0}
          >
            <Text style={styles.sceneBtnText}>🎨 Custom Color</Text>
          </TouchableOpacity>

          {(presets[room.id] ?? []).length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetRow}>
              {(presets[room.id] ?? []).map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  style={styles.presetChip}
                  onPress={() => handleApplyPreset(room, preset)}
                  onLongPress={() => handleDeletePreset(room, preset)}
                  disabled={room.lightCount === 0 || busyRoomId === room.id}
                >
                  <Text style={styles.presetChipText}>{preset.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </TouchableOpacity>
      ))}

      <ColorPickerModal
        visible={pickerRoomId !== null}
        onClose={() => setPickerRoomId(null)}
        roomId={pickerRoomId ?? ''}
        onApplied={handlePickerApplied}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingBottom: 32 },
  loader: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#f8fafc' },
  addBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1e293b' },
  addBtnText: { color: '#f8fafc', fontSize: 13, fontWeight: '600' },
  newRoomRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  newRoomInput: { flex: 1, backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: 12, padding: 14, fontSize: 15 },
  newRoomAddBtn: { justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#3b82f6' },
  newRoomAddText: { color: '#fff', fontWeight: '600' },
  empty: { color: '#475569', textAlign: 'center', marginTop: 24, fontSize: 14, lineHeight: 22, paddingHorizontal: 16 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#f8fafc' },
  cardSub: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  sceneRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  sceneBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  whiteBtn: { backgroundColor: '#3f3a1d' },
  warmBtn: { backgroundColor: '#3f2a1d' },
  partyBtn: { backgroundColor: '#2e1d3f' },
  partyBtnActive: { backgroundColor: '#7c3aed' },
  customBtn: { backgroundColor: '#1d2d3f' },
  customBtnRow: { marginTop: 10 },
  sceneBtnText: { color: '#f8fafc', fontSize: 13, fontWeight: '600' },
  presetRow: { marginTop: 10 },
  presetChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#334155', marginRight: 8 },
  presetChipText: { color: '#f8fafc', fontSize: 13, fontWeight: '600' },
});
