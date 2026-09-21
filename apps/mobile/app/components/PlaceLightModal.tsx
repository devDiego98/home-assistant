import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, FlatList, ScrollView, ActivityIndicator } from 'react-native';
import { api } from '../services/api';
import type { TuyaDevice, RoomWithLights } from '@casa/shared';

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (name: string, deviceId: string, roomId: string | null) => void;
  title?: string;
  confirmLabel?: string;
}

export default function PlaceLightModal({ visible, onClose, onConfirm, title = 'Place Light', confirmLabel = 'Place' }: Props) {
  const [name, setName] = useState('');
  const [devices, setDevices] = useState<TuyaDevice[]>([]);
  const [selected, setSelected] = useState<TuyaDevice | null>(null);
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<RoomWithLights[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    Promise.all([api.tuya.listDevices(), api.rooms.list(), api.floor.listLights()]).then(([devicesRes, roomsRes, linkedRes]) => {
      const linkedIds = new Set(linkedRes.success ? (linkedRes.data as { tuyaDeviceId: string }[]).map((l) => l.tuyaDeviceId) : []);
      if (devicesRes.success) setDevices((devicesRes.data as TuyaDevice[]).filter((d) => !linkedIds.has(d.id)));
      if (roomsRes.success) setRooms(roomsRes.data as RoomWithLights[]);
      setLoading(false);
    });
  }, [visible]);

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    const res = await api.rooms.create({ name: newRoomName.trim() });
    if (res.success) {
      const room = res.data as RoomWithLights;
      setRooms((prev) => [...prev, room]);
      setRoomId(room.id);
    }
    setNewRoomName('');
    setCreatingRoom(false);
  };

  const handleConfirm = () => {
    if (!name.trim() || !selected) return;
    onConfirm(name.trim(), selected.id, roomId);
    setName('');
    setSelected(null);
    setRoomId(null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.label}>Light name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Living Room Ceiling"
            placeholderTextColor="#475569"
            value={name}
            onChangeText={setName}
          />
          <Text style={styles.label}>Select SmartLife device</Text>
          {loading ? (
            <ActivityIndicator color="#3b82f6" style={{ marginVertical: 16 }} />
          ) : devices.length === 0 ? (
            <Text style={styles.empty}>No unlinked SmartLife devices found. Either they're all linked already, or check Tuya credentials in server .env</Text>
          ) : (
            <FlatList
              data={devices}
              keyExtractor={(d) => d.id}
              style={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.deviceRow, selected?.id === item.id && styles.deviceRowSelected]}
                  onPress={() => setSelected(item)}
                >
                  <View style={[styles.dot, item.online ? styles.dotOnline : styles.dotOffline]} />
                  <Text style={styles.deviceName}>{item.name}</Text>
                  <Text style={styles.deviceCategory}>{item.category}</Text>
                </TouchableOpacity>
              )}
            />
          )}
          <Text style={styles.label}>Room (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roomRow}>
            <TouchableOpacity
              style={[styles.roomChip, roomId === null && !creatingRoom && styles.roomChipSelected]}
              onPress={() => { setRoomId(null); setCreatingRoom(false); }}
            >
              <Text style={styles.roomChipText}>No room</Text>
            </TouchableOpacity>
            {rooms.map((room) => (
              <TouchableOpacity
                key={room.id}
                style={[styles.roomChip, roomId === room.id && styles.roomChipSelected]}
                onPress={() => { setRoomId(room.id); setCreatingRoom(false); }}
              >
                <Text style={styles.roomChipText}>{room.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.roomChip, creatingRoom && styles.roomChipSelected]}
              onPress={() => setCreatingRoom(true)}
            >
              <Text style={styles.roomChipText}>+ New room</Text>
            </TouchableOpacity>
          </ScrollView>
          {creatingRoom && (
            <View style={styles.newRoomRow}>
              <TextInput
                style={[styles.input, styles.newRoomInput]}
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
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (!name.trim() || !selected) && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!name.trim() || !selected}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#0f172a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  title: { fontSize: 20, fontWeight: '700', color: '#f8fafc', marginBottom: 20 },
  label: { fontSize: 13, color: '#94a3b8', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: 12, padding: 14, fontSize: 15 },
  list: { maxHeight: 200, marginTop: 4 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 6, backgroundColor: '#1e293b' },
  deviceRowSelected: { borderWidth: 2, borderColor: '#3b82f6' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  dotOnline: { backgroundColor: '#22c55e' },
  dotOffline: { backgroundColor: '#ef4444' },
  deviceName: { flex: 1, color: '#f8fafc', fontSize: 14 },
  deviceCategory: { color: '#64748b', fontSize: 12 },
  empty: { color: '#64748b', textAlign: 'center', marginVertical: 20, fontSize: 13 },
  roomRow: { marginTop: 4 },
  roomChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#1e293b', marginRight: 8 },
  roomChipSelected: { backgroundColor: '#3b82f6' },
  roomChipText: { color: '#f8fafc', fontSize: 13, fontWeight: '600' },
  newRoomRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  newRoomInput: { flex: 1 },
  newRoomAddBtn: { justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#3b82f6' },
  newRoomAddText: { color: '#fff', fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#1e293b', alignItems: 'center' },
  cancelText: { color: '#94a3b8', fontWeight: '600' },
  confirmBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#3b82f6', alignItems: 'center' },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmText: { color: '#fff', fontWeight: '600' },
});
