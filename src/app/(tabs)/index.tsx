import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { EventCard } from '@/components/events/EventCard';
import { EventPreviewCard } from '@/components/events/EventPreviewCard';
import { EventMap, type EventMapHandle } from '@/components/map/EventMap';
import { Button, EmptyView, ErrorView, IconButton, LoadingView, SegmentedControl, Text } from '@/components/ui';
import { useEventList, useEventMap } from '@/features/events/hooks';
import type { EventSummary } from '@/features/events/schemas';
import { FilterChips } from '@/features/search/FilterChips';
import { FilterSheet } from '@/features/search/FilterSheet';
import { SORT_OPTIONS, clearFilters, type Bbox } from '@/features/search/filters';
import { SearchBar } from '@/features/search/SearchBar';
import { useSearch } from '@/features/search/SearchContext';
import { CAIRO, regionChangedSignificantly, regionToBbox, type Region } from '@/lib/geo';
import { useUserLocation } from '@/lib/location';
import { useTheme } from '@/theme/ThemeProvider';

type ExploreView = 'map' | 'list';

export default function ExploreScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const { filters, setFilters } = useSearch();
  const { location, status: locationStatus } = useUserLocation();
  const [view, setView] = useState<ExploreView>('map');
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Height of the floating search header, measured so content starts below it at any font size.
  const [topInset, setTopInset] = useState(150);

  return (
    <View style={{ flex: 1 }}>
      {view === 'map' ? <MapMode location={location} topInset={topInset} /> : <ListMode location={location} topInset={topInset} />}

      <SafeAreaView
        edges={['top']}
        style={[styles.top, view === 'list' ? { backgroundColor: colors.background } : null]}
        pointerEvents="box-none"
        onLayout={(e) => setTopInset(e.nativeEvent.layout.height)}
      >
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }} pointerEvents="box-none">
          <SearchBar onOpenFilters={() => setFiltersOpen(true)} />
          <FilterChips />
          <View style={{ alignSelf: 'center', width: 220 }}>
            <SegmentedControl<ExploreView>
              value={view}
              onChange={setView}
              options={[
                { value: 'map', label: t('explore.map') },
                { value: 'list', label: t('explore.list') },
              ]}
            />
          </View>
        </View>
        <View style={{ height: spacing.sm }} />
      </SafeAreaView>

      <FilterSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} hasLocation={Boolean(location)} />
      {locationStatus === 'denied' && filters.sort === 'nearest' ? (
        <View style={[styles.toast, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="small">{t('filters.needsLocation')}</Text>
          <Button title={t('common.ok')} size="sm" variant="ghost" onPress={() => setFilters((f) => ({ ...f, sort: 'soonest' }))} />
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------
function MapMode({ location, topInset }: { location: { lat: number; lng: number } | null; topInset: number }) {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const { filters, setFilters } = useSearch();
  const mapRef = useRef<EventMapHandle>(null);
  const [region, setRegion] = useState<Region>(CAIRO);
  const [searchedRegion, setSearchedRegion] = useState<Region | null>(null);
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [selectedRaw, setSelected] = useState<EventSummary | null>(null);
  const centeredOnUser = useRef(false);

  // Center on the user once their location is known (Cairo otherwise).
  useEffect(() => {
    if (location && !centeredOnUser.current) {
      centeredOnUser.current = true;
      mapRef.current?.animateTo({ latitude: location.lat, longitude: location.lng, latitudeDelta: 0.15, longitudeDelta: 0.15 });
    }
  }, [location]);

  const query = useEventMap(filters, bbox, location);
  const events = useMemo(() => query.data?.rows ?? [], [query.data]);

  // Drop the selection if it no longer matches the filters.
  const selected = selectedRaw && events.some((e) => e.id === selectedRaw.id) ? selectedRaw : null;

  // Compare against the last searched area, or the first region the map reported.
  const [baseline, setBaseline] = useState<Region | null>(null);
  const showSearchArea = baseline !== null && regionChangedSignificantly(searchedRegion ?? baseline, region);

  return (
    <View style={StyleSheet.absoluteFill}>
      <EventMap
        ref={mapRef}
        events={events}
        initialRegion={CAIRO}
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
        onRegionChange={(r) => {
          setRegion(r);
          setBaseline((b) => b ?? r);
        }}
        showsUserLocation={Boolean(location)}
      />

      <View pointerEvents="box-none" style={styles.mapTopSpacer}>
        <View pointerEvents="box-none" style={{ marginTop: topInset, alignItems: 'center', gap: spacing.sm }}>
          {showSearchArea ? (
            <Button
              title={t('map.searchThisArea')}
              icon="refresh"
              size="sm"
              onPress={() => {
                setBbox(regionToBbox(region));
                setSearchedRegion(region);
              }}
            />
          ) : null}
          {query.isFetching ? <ActivityIndicator color={colors.primary} /> : null}
        </View>
      </View>

      <View style={[styles.mapBottom, { padding: spacing.lg, gap: spacing.sm }]} pointerEvents="box-none">
        <View style={styles.mapBottomRow} pointerEvents="box-none">
          <View style={[styles.countPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text variant="small" style={{ fontWeight: '700' }} accessibilityLiveRegion="polite">
              {query.error ? t('common.somethingWrong') : t('explore.resultCount', { count: events.length })}
            </Text>
            {bbox ? (
              <Pressable
                onPress={() => {
                  setBbox(null);
                  setSearchedRegion(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('map.showAllAreas')}
                hitSlop={8}
              >
                <Text variant="small" color="primary" style={{ fontWeight: '700' }}>
                  {' · '}
                  {t('map.showAllAreas')}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {location ? (
            <IconButton
              icon="locate"
              label={t('map.myLocation')}
              background={colors.surface}
              color="primary"
              onPress={() => mapRef.current?.animateTo({ latitude: location.lat, longitude: location.lng, latitudeDelta: 0.08, longitudeDelta: 0.08 })}
            />
          ) : null}
        </View>
        {selected ? <EventPreviewCard event={selected} onClose={() => setSelected(null)} /> : null}
        {!query.isLoading && !query.error && events.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border, padding: spacing.lg }]}>
            <Text variant="bodyStrong">{t('explore.noResults')}</Text>
            <Text variant="caption" color="textMuted">
              {t('explore.noResultsHint')}
            </Text>
            <Button title={t('filters.clearAll')} variant="secondary" size="sm" onPress={() => setFilters(clearFilters)} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------
function ListMode({ location, topInset }: { location: { lat: number; lng: number } | null; topInset: number }) {
  const { spacing, colors } = useTheme();
  const { t } = useTranslation();
  const { filters, setFilters } = useSearch();
  const query = useEventList(filters, location);
  const events = useMemo(() => query.data?.pages.flatMap((p) => p.rows) ?? [], [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;

  const header = (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.sortRow}>
        <Text variant="caption" color="textMuted" style={{ flex: 1 }} accessibilityLiveRegion="polite">
          {t('explore.resultCount', { count: total })}
        </Text>
      </View>
      <SegmentedControl
        value={filters.sort}
        onChange={(sort) => setFilters((f) => ({ ...f, sort }))}
        options={SORT_OPTIONS.map((s) => ({ value: s, label: t(`sort.${s}`) }))}
      />
    </View>
  );

  if (query.isLoading) {
    return (
      <View style={{ flex: 1, paddingTop: topInset }}>
        <LoadingView />
      </View>
    );
  }
  if (query.error && !events.length) {
    return (
      <View style={{ flex: 1, paddingTop: topInset }}>
        <ErrorView error={query.error} onRetry={() => query.refetch()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, paddingTop: topInset }}>
      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => <EventCard event={item} />}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyView
            icon="search-outline"
            title={t('explore.noResults')}
            message={t('explore.noResultsHint')}
            actionLabel={t('filters.clearAll')}
            onAction={() => setFilters(clearFilters)}
          />
        }
        onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null}
        refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => query.refetch()} tintColor={colors.primary} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 8 },
  mapTopSpacer: { position: 'absolute', top: 0, left: 0, right: 0 },
  mapBottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  mapBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countPill: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  emptyCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, gap: 6 },
  sortRow: { flexDirection: 'row', alignItems: 'center' },
  toast: { position: 'absolute', bottom: 24, left: 16, right: 16, borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
});

