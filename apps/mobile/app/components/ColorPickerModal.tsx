import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { api } from '../services/api';
import ColorWheel from './ColorWheel';
import GradientSlider from './GradientSlider';

interface Props {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  onApplied: () => void;
}

// Warm (orange, ~2700K) to cool (blue, ~6500K) — matches Tuya's colorTemp 0-1000 range.
const TEMP_GRADIENT: [string, string, ...string[]] = ['#ff9d42', '#fff4e0', '#cfe8ff'];

export default function ColorPickerModal({ visible, onClose, roomId, onApplied }: Props) {
  const [mode, setMode] = useState<'colour' | 'white'>('colour');
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(1000);
  const [brightness, setBrightness] = useState(100);
  const [colorTemp, setColorTemp] = useState(500);
  const [presetName, setPresetName] = useState('');
  const [applying, setApplying] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleApply = async () => {
    setApplying(true);
    if (mode === 'colour') {
      await api.rooms.applyColor(roomId, { h: hue, s: saturation, v: Math.round((brightness / 100) * 1000) });
    } else {
      await api.rooms.applyWhite(roomId, { brightness, colorTemp });
    }
    setApplying(false);
    onApplied();
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) return;
    setSaving(true);
    const res = await api.rooms.presets.create(roomId, {
      name: presetName.trim(),
      mode,
      h: mode === 'colour' ? hue : undefined,
      s: mode === 'colour' ? saturation : undefined,
      brightness,
      colorTemp: mode === 'white' ? colorTemp : undefined,
    });
    setSaving(false);
    if (res.success) {
      setPresetName('');
      onApplied();
    }
  };

  const brightnessColors: [string, string, ...string[]] = mode === 'colour'
    ? ['#000000', `hsl(${hue}, ${saturation / 10}%, 50%)`]
    : ['#000000', '#ffffff'];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Custom Light</Text>

          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'colour' && styles.modeBtnSelected]}
              onPress={() => setMode('colour')}
            >
              <Text style={styles.modeBtnText}>Color</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'white' && styles.modeBtnSelected]}
              onPress={() => setMode('white')}
            >
              <Text style={styles.modeBtnText}>White</Text>
            </TouchableOpacity>
          </View>

          {mode === 'colour' ? (
            <View style={styles.wheelWrap}>
              <ColorWheel hue={hue} saturation={saturation} onChange={(h, s) => { setHue(h); setSaturation(s); }} />
            </View>
          ) : (
            <>
              <Text style={styles.label}>Warm ↔ Cool</Text>
              <GradientSlider value={colorTemp / 1000} onChange={(v) => setColorTemp(Math.round(v * 1000))} colors={TEMP_GRADIENT} />
            </>
          )}

          <Text style={styles.label}>Brightness</Text>
          <GradientSlider value={brightness / 100} onChange={(v) => setBrightness(Math.round(v * 100))} colors={brightnessColors} />

          <TouchableOpacity style={styles.applyBtn} onPress={handleApply} disabled={applying}>
            {applying ? <ActivityIndicator color="#fff" /> : <Text style={styles.applyBtnText}>Apply to Room</Text>}
          </TouchableOpacity>

          <Text style={styles.label}>Save as preset</Text>
          <View style={styles.saveRow}>
            <TextInput
              style={[styles.input, styles.saveInput]}
              placeholder="e.g. Movie Night"
              placeholderTextColor="#475569"
              value={presetName}
              onChangeText={setPresetName}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSavePreset} disabled={!presetName.trim() || saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#0f172a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '88%' },
  title: { fontSize: 20, fontWeight: '700', color: '#f8fafc', marginBottom: 16 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#1e293b', alignItems: 'center' },
  modeBtnSelected: { backgroundColor: '#3b82f6' },
  modeBtnText: { color: '#f8fafc', fontSize: 14, fontWeight: '600' },
  wheelWrap: { alignItems: 'center', marginBottom: 16 },
  label: { fontSize: 13, color: '#94a3b8', marginBottom: 8, marginTop: 12 },
  applyBtn: { marginTop: 20, backgroundColor: '#3b82f6', borderRadius: 12, padding: 14, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  saveRow: { flexDirection: 'row', gap: 8 },
  input: { backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: 12, padding: 14, fontSize: 15 },
  saveInput: { flex: 1 },
  saveBtn: { justifyContent: 'center', paddingHorizontal: 18, borderRadius: 12, backgroundColor: '#1e293b' },
  saveBtnText: { color: '#f8fafc', fontWeight: '600' },
  closeBtn: { marginTop: 16, alignItems: 'center', padding: 10 },
  closeBtnText: { color: '#64748b', fontWeight: '600' },
});
