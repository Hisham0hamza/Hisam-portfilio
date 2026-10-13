import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button, Icon, IconButton, Text } from '@/components/ui';
import { reverseGeocode, searchPlaces, type Place } from '@/lib/geocoding';
import { CAIRO, type Region } from '@/lib/geo';
import { useTheme } from '@/theme/ThemeProvider';

import { PickerMap, type PickerMapHandle } from './PickerMap';

export type PickedLocation = { lat: number; lng: number; address: string | null; name?: string };

/**
 * Full-screen picker: search a place or pan the map under the fixed centre pin, then confirm.
 */
export function LocationPicker({
  visible,
  title,
  initial,
  onClose,
  onPick,
}: {
  visible: boolean;
  title: string;
  initial?: { lat: number; lng: number } | null;
  onClose: () => void;
  onPick: (loc: PickedLocation) => void;
}) {
  const { colors, radius, spacing, typography } = useTheme();
  const { t, i18n } = useTranslation();
  const mapRef = useRef<PickerMapHandle>(null);
  const startRegion: Region = initial
    ? { latitude: initial.lat, longitude: initial.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : CAIRO;
  const [center, setCenter] = useState({ lat: startRegion.latitude, lng: startRegion.longitude });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [placeName, setPlaceName] = useState<string | undefined>();
  const [chosen, setChosen] = useState(false);

  // Once a result is chosen we stop searching until the text is edited again.
  const searchable = query.trim().length >= 2 && !chosen;
  const shownResults = searchable ? results : [];

  // Debounced place search.
  useEffect(() => {
    if (!searchable) return;
    let cancelled = false;
    const id = setTimeout(() => {
      setSearching(true);
      searchPlaces(query, i18n.language === 'ar' ? 'ar' : 'en', center)
        .then((r) => !cancelled && setResults(r))
        .catch(() => !cancelled && setResults([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the text changes
  }, [query, searchable]);

  const choose = (p: Place) => {
    setChosen(true);
    setQuery(p.name);
    setPlaceName(p.address);
    mapRef.current?.flyTo(p.lat, p.lng);
  };

  const confirm = async () => {
    setConfirming(true);
    const address = placeName ?? (await reverseGeocode(center.lat, center.lng));
    setConfirming(false);
    onPick({ ...center, address, name: query.trim() || undefined });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.header, { paddingHorizontal: spacing.sm }]}>
          <IconButton icon="close" label={t('common.close')} onPress={onClose} />
          <Text variant="heading" style={{ flex: 1 }} align="center" accessibilityRole="header">
            {title}
          </Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={{ paddingHorizontal: spacing.lg, zIndex: 2 }}>
          <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md }]}>
            <Icon name="search" color="textMuted" />
            <TextInput
              value={query}
              onChangeText={(v) => {
                setQuery(v);
                setChosen(false);
                setPlaceName(undefined);
              }}
              placeholder={t('picker.searchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={t('picker.searchPlaceholder')}
              style={[typography.body, { flex: 1, color: colors.text, minHeight: 44, textAlign: 'auto' as never }]}
              returnKeyType="search"
            />
            {searching && searchable ? <ActivityIndicator color={colors.primary} /> : null}
          </View>
          {shownResults.length ? (
            <FlatList
              data={shownResults}
              keyExtractor={(p) => p.id}
              keyboardShouldPersistTaps="handled"
              style={[styles.results, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md }]}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => choose(item)}
                  accessibilityRole="button"
                  style={({ pressed }) => [{ padding: spacing.md, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' }]}
                >
                  <Text variant="bodyStrong">{item.name}</Text>
                  <Text variant="small" color="textMuted" numberOfLines={1}>
                    {item.address}
                  </Text>
                </Pressable>
              )}
            />
          ) : null}
        </View>
        <View style={{ flex: 1, marginTop: spacing.md }}>
          <PickerMap
            ref={mapRef}
            initialRegion={startRegion}
            onCenterChange={setCenter}
            onUserDrag={() => setPlaceName(undefined)}
          />
          <View pointerEvents="none" style={styles.centerPin}>
            <Icon name="location" size={44} color="accent" />
          </View>
        </View>
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          <Text variant="small" color="textMuted" align="center">
            {t('picker.hint')}
          </Text>
          <Button title={t('picker.confirm')} icon="checkmark" loading={confirming} onPress={confirm} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderWidth: 1 },
  results: { position: 'absolute', top: 52, left: 16, right: 16, maxHeight: 260, borderWidth: 1 },
  centerPin: { position: 'absolute', top: '50%', left: '50%', marginLeft: -22, marginTop: -44 },
});
