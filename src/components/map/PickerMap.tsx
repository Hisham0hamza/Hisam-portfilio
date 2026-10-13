import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView from 'react-native-maps';

import type { Region } from '@/lib/geo';
import { useTheme } from '@/theme/ThemeProvider';

export type PickerMapHandle = { flyTo: (lat: number, lng: number) => void };

type Props = {
  initialRegion: Region;
  onCenterChange: (center: { lat: number; lng: number }) => void;
  onUserDrag: () => void;
};

/** Map under the fixed centre pin of the location picker (native). */
export const PickerMap = forwardRef<PickerMapHandle, Props>(function PickerMap({ initialRegion, onCenterChange, onUserDrag }, ref) {
  const mapRef = useRef<MapView>(null);
  const { scheme } = useTheme();
  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng) => mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.006, longitudeDelta: 0.006 }, 350),
  }));
  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      userInterfaceStyle={scheme}
      showsUserLocation
      onRegionChangeComplete={(r) => onCenterChange({ lat: r.latitude, lng: r.longitude })}
      onPanDrag={onUserDrag}
    />
  );
});
