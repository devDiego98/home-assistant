import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  Dimensions, GestureResponderEvent, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../store/auth';
import { api } from '../services/api';
import PlaceLightModal from '../components/PlaceLightModal';
import type { FloorLight } from '@casa/shared';

import FLOOR_PLAN from '../../assets/floor_layout.png';
const SCREEN_W = Dimensions.get('window').width;
const PLAN_W = SCREEN_W - 32;

export default function HomeScreen() {
  const { user } = useAuthStore();
  const [lights, setLights] = useState<FloorLight[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [planHeight, setPlanHeight] = useState(220);
  const [loading, setLoading] = useState(true);

  const fetchLights = useCallback(async () => {
    const res = await api.floor.listLights();
    if (res.success) setLights(res.data as FloorLight[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchLights(); }, [fetchLights]));

  // Compute rendered image height from natural aspect ratio
  useEffect(() => {
    const src = Image.resolveAssetSource(FLOOR_PLAN);
    if (src?.width && src?.height) {
      setPlanHeight((PLAN_W * src.height) / src.width);
    }
  }, []);

  const handleFloorTap = (e: GestureResponderEvent) => {
    if (!editMode) return;
    const { locationX, locationY } = e.nativeEvent;
    setPendingPos({ x: locationX / PLAN_W, y: locationY / planHeight });
    setShowModal(true);
  };

  const handlePlaceConfirm = async (name: string, deviceId: string) => {
    if (!pendingPos) return;
    setShowModal(false);
    const res = await api.floor.placeLight({
      name,
      tuyaDeviceId: deviceId,
      positionX: pendingPos.x,
      positionY: pendingPos.y,
    });
    if (res.success) {
      setLights((prev) => [...prev, res.data as FloorLight]);
    }
    setPendingPos(null);
  };

  const handleToggle = async (light: FloorLight) => {
    if (editMode) {
      Alert.alert(
        light.name,
        'What do you want to do?',
        [
          { text: 'Remove', style: 'destructive', onPress: async () => {
            await api.floor.removeLight(light.id);
            setLights((prev) => prev.filter((l) => l.id !== light.id));
          }},
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }
    const newState = !light.isOn;
    setLights((prev) => prev.map((l) => l.id === light.id ? { ...l, isOn: newState } : l));
    await api.floor.toggleLight(light.id, newState);
  };

  const lightsOn = lights.filter((l) => l.isOn).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey, {user?.name?.split(' ')[0] ?? 'there'}</Text>
          <Text style={styles.sub}>{lightsOn} light{lightsOn !== 1 ? 's' : ''} on</Text>
        </View>
        <TouchableOpacity
          style={[styles.editBtn, editMode && styles.editBtnActive]}
          onPress={() => setEditMode((v) => !v)}
        >
          <Text style={styles.editBtnText}>{editMode ? 'Done' : 'Edit Layout'}</Text>
        </TouchableOpacity>
      </View>

      {editMode && (
        <View style={styles.editHint}>
          <Text style={styles.editHintText}>Tap on the floor plan to place a light · Tap a light to remove it</Text>
        </View>
      )}

      {/* Floor Plan */}
      <View style={[styles.planContainer, { height: planHeight }]}>
        <Image source={FLOOR_PLAN} style={[styles.planImage, { height: planHeight }]} resizeMode="stretch" />

        {/* Tap overlay */}
        <TouchableOpacity
          activeOpacity={1}
          style={StyleSheet.absoluteFill}
          onPress={handleFloorTap}
        />

        {/* Light buttons */}
        {lights.map((light) => (
          <TouchableOpacity
            key={light.id}
            style={[
              styles.lightBtn,
              {
                left: light.positionX * PLAN_W - 18,
                top: light.positionY * planHeight - 18,
              },
              light.isOn && styles.lightBtnOn,
            ]}
            onPress={() => handleToggle(light)}
          >
            <Text style={styles.lightIcon}>{light.isOn ? '💡' : '○'}</Text>
          </TouchableOpacity>
        ))}

        {loading && (
          <View style={styles.planLoading}>
            <ActivityIndicator color="#3b82f6" />
          </View>
        )}
      </View>

      {/* Light list below the plan */}
      {lights.length > 0 && (
        <View style={styles.lightList}>
          {lights.map((light) => (
            <TouchableOpacity
              key={light.id}
              style={[styles.lightRow, light.isOn && styles.lightRowOn]}
              onPress={() => handleToggle(light)}
            >
              <Text style={styles.lightRowIcon}>{light.isOn ? '💡' : '○'}</Text>
              <Text style={styles.lightRowName}>{light.name}</Text>
              <View style={[styles.lightRowBadge, light.isOn ? styles.badgeOn : styles.badgeOff]}>
                <Text style={styles.lightRowBadgeText}>{light.isOn ? 'On' : 'Off'}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {lights.length === 0 && !loading && (
        <Text style={styles.empty}>
          {editMode
            ? 'Tap anywhere on the floor plan to place your first light'
            : 'Tap "Edit Layout" to start placing lights on your floor plan'}
        </Text>
      )}

      <PlaceLightModal
        visible={showModal}
        onClose={() => { setShowModal(false); setPendingPos(null); }}
        onConfirm={handlePlaceConfirm}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  greeting: { fontSize: 24, fontWeight: '700', color: '#f8fafc' },
  sub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  editBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1e293b' },
  editBtnActive: { backgroundColor: '#3b82f6' },
  editBtnText: { color: '#f8fafc', fontSize: 13, fontWeight: '600' },
  editHint: { backgroundColor: '#1e3a5f', borderRadius: 10, padding: 10, marginBottom: 10 },
  editHintText: { color: '#93c5fd', fontSize: 12, textAlign: 'center' },
  planContainer: { width: PLAN_W, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1e293b', position: 'relative' },
  planImage: { width: PLAN_W },
  planLoading: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  lightBtn: {
    position: 'absolute',
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(30,41,59,0.85)',
    borderWidth: 2, borderColor: '#475569',
    justifyContent: 'center', alignItems: 'center',
  },
  lightBtnOn: {
    backgroundColor: 'rgba(251,191,36,0.25)',
    borderColor: '#fbbf24',
    shadowColor: '#fbbf24',
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 6,
  },
  lightIcon: { fontSize: 16 },
  lightList: { marginTop: 16, gap: 8 },
  lightRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 14, padding: 14 },
  lightRowOn: { backgroundColor: '#1c2a1a' },
  lightRowIcon: { fontSize: 18, marginRight: 12 },
  lightRowName: { flex: 1, color: '#f8fafc', fontSize: 15 },
  lightRowBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeOn: { backgroundColor: '#14532d' },
  badgeOff: { backgroundColor: '#1e293b' },
  lightRowBadgeText: { color: '#f8fafc', fontSize: 12, fontWeight: '600' },
  empty: { color: '#475569', textAlign: 'center', marginTop: 24, fontSize: 14, lineHeight: 22, paddingHorizontal: 16 },
});
