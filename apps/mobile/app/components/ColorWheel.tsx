import { useRef } from 'react';
import { View, PanResponder, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

// locationX/locationY are relative to whichever sub-view is currently under the finger,
// which shifts mid-drag once the thumb (an absolutely-positioned sibling) moves under it —
// that's what causes the value to jump/glitch. pageX/pageY are always screen-relative, so
// combined with a fixed, once-measured container origin they stay stable for the whole drag.

interface Props {
  size?: number;
  hue: number; // 0-360
  saturation: number; // 0-1000
  onChange: (hue: number, saturation: number) => void;
}

const WEDGES = 48;

// hueDeg=0 is straight up, increasing clockwise — matches the touch-angle math below.
function pointForHue(cx: number, cy: number, r: number, hueDeg: number) {
  const rad = ((hueDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function wedgePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = pointForHue(cx, cy, r, endDeg);
  const end = pointForHue(cx, cy, r, startDeg);
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 0 0 ${end.x} ${end.y} Z`;
}

export default function ColorWheel({ size = 240, hue, saturation, onChange }: Props) {
  const center = size / 2;
  const radius = size / 2;
  const containerRef = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });

  const handleTouch = (pageX: number, pageY: number) => {
    const dx = pageX - origin.current.x - center;
    const dy = pageY - origin.current.y - center;
    const distance = Math.min(Math.sqrt(dx * dx + dy * dy), radius);
    const hueDeg = (((Math.atan2(dy, dx) * 180) / Math.PI + 90) % 360 + 360) % 360;
    const sat = Math.round((distance / radius) * 1000);
    onChange(Math.round(hueDeg), sat);
  };

  const measureOrigin = () => {
    containerRef.current?.measureInWindow((x, y) => { origin.current = { x, y }; });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Re-measure on every gesture start, not just layout — the wheel sits inside a
      // sliding modal sheet, so its on-screen position at layout time (mid-animation)
      // can be stale by the time the user actually touches it. measureInWindow() is
      // async, so the touch is only processed once the fresh origin comes back.
      onPanResponderGrant: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        containerRef.current?.measureInWindow((x, y) => {
          origin.current = { x, y };
          handleTouch(pageX, pageY);
        });
      },
      onPanResponderMove: (evt) => handleTouch(evt.nativeEvent.pageX, evt.nativeEvent.pageY),
    }),
  ).current;

  const thumb = pointForHue(center, center, (saturation / 1000) * radius, hue);
  const wedgeAngle = 360 / WEDGES;

  return (
    <View ref={containerRef} style={{ width: size, height: size }} onLayout={measureOrigin} {...panResponder.panHandlers}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="desaturate" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {Array.from({ length: WEDGES }, (_, i) => {
          const startDeg = i * wedgeAngle;
          const endDeg = startDeg + wedgeAngle;
          const midDeg = startDeg + wedgeAngle / 2;
          return (
            <Path key={i} d={wedgePath(center, center, radius, startDeg, endDeg)} fill={`hsl(${midDeg}, 100%, 50%)`} />
          );
        })}
        <Circle cx={center} cy={center} r={radius} fill="url(#desaturate)" />
      </Svg>
      <View style={[styles.thumb, { left: thumb.x - 12, top: thumb.y - 12, backgroundColor: `hsl(${hue}, ${saturation / 10}%, 50%)` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#f8fafc',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
});
