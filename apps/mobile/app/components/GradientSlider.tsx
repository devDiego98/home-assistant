import { useRef } from 'react';
import { View, PanResponder, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  value: number; // 0-1, normalized
  onChange: (value: number) => void;
  colors: [string, string, ...string[]];
  height?: number;
}

export default function GradientSlider({ value, onChange, colors, height = 32 }: Props) {
  const containerRef = useRef<View>(null);
  const widthRef = useRef(0);
  const originXRef = useRef(0);

  // Same fix as ColorWheel: locationX is relative to whatever sub-view is currently
  // under the finger, which shifts once the thumb moves under it, causing the value to
  // jump/glitch mid-drag. pageX combined with a measured, fixed container origin is stable.
  const handleTouch = (pageX: number) => {
    if (widthRef.current === 0) return;
    const x = pageX - originXRef.current;
    const clamped = Math.max(0, Math.min(widthRef.current, x));
    onChange(clamped / widthRef.current);
  };

  const measureOrigin = () => {
    containerRef.current?.measureInWindow((x) => { originXRef.current = x; });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Re-measure on every gesture start — the slider sits inside a sliding modal
      // sheet, so its on-screen position at layout time can be stale by touch time.
      onPanResponderGrant: (evt) => {
        const { pageX } = evt.nativeEvent;
        containerRef.current?.measureInWindow((x) => {
          originXRef.current = x;
          handleTouch(pageX);
        });
      },
      onPanResponderMove: (evt) => handleTouch(evt.nativeEvent.pageX),
    }),
  ).current;

  return (
    <View
      ref={containerRef}
      style={[styles.track, { height, borderRadius: height / 2 }]}
      onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width; measureOrigin(); }}
      {...panResponder.panHandlers}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradient, { borderRadius: height / 2 }]}
      />
      <View
        style={[
          styles.thumb,
          {
            left: `${value * 100}%`,
            marginLeft: -(height / 2 + 3),
            width: height + 6,
            height: height + 6,
            borderRadius: (height + 6) / 2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'visible', justifyContent: 'center' },
  gradient: { ...StyleSheet.absoluteFillObject },
  thumb: {
    position: 'absolute',
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#0f172a',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
});
