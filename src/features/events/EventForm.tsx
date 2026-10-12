import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LocationPicker } from '@/components/map/LocationPicker';
import {
  Button,
  Card,
  Chip,
  DateField,
  Icon,
  IconButton,
  Row,
  Screen,
  Section,
  SegmentedControl,
  Text,
  TextField,
  ToggleRow,
} from '@/components/ui';
import { errorKey } from '@/lib/errors';
import { pickImages } from '@/lib/images';
import { useTheme } from '@/theme/ThemeProvider';

import { useCities, useSaveEvent } from './hooks';
import {
  CATEGORIES,
  DIFFICULTIES,
  EVENT_LANGUAGES,
  MAX_GALLERY_PHOTOS,
  eventFormSchema,
  publishIssues,
  type ApprovalMode,
  type Category,
  type Difficulty,
  type EventDetail,
  type EventStatus,
  type FormPhoto,
  type LatLng,
  type StopInput,
} from './schemas';
import { CATEGORY_ICONS, useLabels } from './useLabels';

type FormState = {
  title: string;
  description: string;
  category: Category;
  city: string;
  area: string;
  meetingPoint: LatLng | null;
  meetingAddress: string;
  stops: StopInput[];
  startAt: Date | null;
  endAt: Date | null;
  hours: string;
  minutes: string;
  difficulty: Difficulty;
  distanceKm: string;
  priceEgp: string;
  includes: string;
  capacity: string;
  languages: string[];
  womenOnly: boolean;
  familyFriendly: boolean;
  whatToBring: string;
  cancellationPolicy: string;
  approvalMode: ApprovalMode;
  cover: FormPhoto | null;
  gallery: FormPhoto[];
};

function initialState(event?: EventDetail): FormState {
  if (!event) {
    const start = new Date();
    start.setDate(start.getDate() + 7);
    start.setHours(9, 0, 0, 0);
    return {
      title: '',
      description: '',
      category: 'heritage_walk',
      city: 'cairo',
      area: '',
      meetingPoint: null,
      meetingAddress: '',
      stops: [],
      startAt: start,
      endAt: null,
      hours: '2',
      minutes: '0',
      difficulty: 'easy',
      distanceKm: '',
      priceEgp: '0',
      includes: '',
      capacity: '15',
      languages: ['ar'],
      womenOnly: false,
      familyFriendly: false,
      whatToBring: '',
      cancellationPolicy: '',
      approvalMode: 'auto',
      cover: null,
      gallery: [],
    };
  }
  return {
    title: event.title,
    description: event.description,
    category: event.category,
    city: event.city,
    area: event.area ?? '',
    meetingPoint: { lat: event.meeting_lat, lng: event.meeting_lng },
    meetingAddress: event.meeting_address,
    stops: event.stops.map((s) => ({ name: s.name, lat: s.lat, lng: s.lng })),
    startAt: new Date(event.start_at),
    endAt: event.end_at ? new Date(event.end_at) : null,
    hours: String(Math.floor(event.duration_minutes / 60)),
    minutes: String(event.duration_minutes % 60),
    difficulty: event.difficulty,
    distanceKm: event.distance_km != null ? String(event.distance_km) : '',
    priceEgp: String(event.price_egp),
    includes: event.includes ?? '',
    capacity: String(event.capacity),
    languages: event.languages,
    womenOnly: event.women_only,
    familyFriendly: event.family_friendly,
    whatToBring: event.what_to_bring ?? '',
    cancellationPolicy: event.cancellation_policy ?? '',
    approvalMode: event.approval_mode,
    cover: event.cover_url ? { uri: event.cover_url, remote: true } : null,
    gallery: event.photos.map((p) => ({ uri: p.url, remote: true })),
  };
}

const num = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return v.trim() === '' || Number.isNaN(n) ? NaN : n;
};

export function EventForm({ event }: { event?: EventDetail }) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const l = useLabels();
  const { data: cities } = useCities();
  const save = useSaveEvent();
  const [s, setS] = useState<FormState>(() => initialState(event));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<null | 'meeting' | 'stop'>(null);
  const [savingAs, setSavingAs] = useState<EventStatus | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setS((p) => ({ ...p, [k]: v }));
  const isMultiDay = s.category === 'multi_day_trip';
  const isPublished = event?.status === 'published';

  const durationMinutes = useMemo(() => {
    if (isMultiDay && s.startAt && s.endAt) return Math.round((s.endAt.getTime() - s.startAt.getTime()) / 60000);
    return (num(s.hours) || 0) * 60 + (num(s.minutes) || 0);
  }, [isMultiDay, s.startAt, s.endAt, s.hours, s.minutes]);

  const err = (key: string) => (errors[key] ? t(`form.errors.${errors[key]}` as 'form.errors.required', { defaultValue: t('form.errors.invalid') }) : null);

  const submit = (status: EventStatus) => {
    const parsed = eventFormSchema.safeParse({
      title: s.title,
      description: s.description,
      category: s.category,
      city: s.city,
      area: s.area,
      meetingPoint: s.meetingPoint,
      meetingAddress: s.meetingAddress,
      stops: s.stops,
      startAt: s.startAt ?? undefined,
      endAt: isMultiDay ? s.endAt : null,
      durationMinutes,
      difficulty: s.difficulty,
      distanceKm: s.distanceKm.trim() ? num(s.distanceKm) : null,
      priceEgp: num(s.priceEgp || '0'),
      includes: s.includes,
      capacity: num(s.capacity),
      languages: s.languages,
      womenOnly: s.womenOnly,
      familyFriendly: s.familyFriendly,
      whatToBring: s.whatToBring,
      cancellationPolicy: s.cancellationPolicy,
      approvalMode: s.approvalMode,
      cover: s.cover,
      gallery: s.gallery,
    });

    const next: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!next[key]) next[key] = issue.code === 'invalid_type' ? 'required' : issue.message;
      }
    } else if (status === 'published') {
      publishIssues(parsed.data).forEach((k) => (next[k] = 'in_past'));
    }
    setErrors(next);
    if (Object.keys(next).length || !parsed.success) {
      Alert.alert(t('form.fixErrorsTitle'), t('form.fixErrorsBody'));
      return;
    }

    setSavingAs(status);
    save.mutate(
      { id: event?.id, values: parsed.data, status },
      {
        onSuccess: (id) => {
          setSavingAs(null);
          router.replace(`/event/${id}`);
        },
        onError: (e) => {
          setSavingAs(null);
          Alert.alert(t('form.saveFailed'), t(errorKey(e)));
        },
      },
    );
  };

  const addPhotos = async (kind: 'cover' | 'gallery') => {
    const remaining = MAX_GALLERY_PHOTOS - s.gallery.length;
    const picked = await pickImages(kind === 'cover' ? {} : { multiple: true, limit: remaining });
    if (!picked.length) return;
    if (kind === 'cover') set('cover', { uri: picked[0].uri, remote: false });
    else set('gallery', [...s.gallery, ...picked.slice(0, remaining).map((p) => ({ uri: p.uri, remote: false }))]);
  };

  const moveStop = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= s.stops.length) return;
    const stops = [...s.stops];
    [stops[i], stops[j]] = [stops[j], stops[i]];
    set('stops', stops);
  };

  return (
    <Screen
      scroll
      edges={[]}
      footer={
        <Row gap={spacing.sm}>
          {!isPublished ? (
            <View style={{ flex: 1 }}>
              <Button title={t('form.saveDraft')} variant="ghost" loading={savingAs === 'draft'} disabled={save.isPending} onPress={() => submit('draft')} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Button
              title={isPublished ? t('form.saveChanges') : t('form.publish')}
              icon="rocket-outline"
              loading={savingAs === 'published'}
              disabled={save.isPending}
              onPress={() => submit('published')}
            />
          </View>
        </Row>
      }
    >
      {/* Basics */}
      <Section title={t('form.basics')}>
        <TextField label={t('form.title')} value={s.title} onChangeText={(v) => set('title', v)} error={err('title')} maxLength={120} />
        <TextField
          label={t('form.description')}
          value={s.description}
          onChangeText={(v) => set('description', v)}
          multiline
          error={err('description')}
          hint={t('form.descriptionHint')}
          maxLength={5000}
        />
        <Text variant="caption" style={{ fontWeight: '600' }}>
          {t('filters.category')}
        </Text>
        <Row wrap gap={spacing.sm}>
          {CATEGORIES.map((c) => (
            <Chip key={c} label={l.category(c)} icon={CATEGORY_ICONS[c]} selected={s.category === c} onPress={() => set('category', c)} />
          ))}
        </Row>
      </Section>

      {/* Photos */}
      <Section title={t('form.photos')}>
        <Pressable
          onPress={() => addPhotos('cover')}
          accessibilityRole="button"
          accessibilityLabel={s.cover ? t('form.changeCover') : t('form.addCover')}
          style={[styles.cover, { borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt }]}
        >
          {s.cover ? (
            <Image source={{ uri: s.cover.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={{ alignItems: 'center', gap: spacing.xs }}>
              <Icon name="image-outline" size={32} color="textMuted" />
              <Text color="textMuted">{t('form.addCover')}</Text>
            </View>
          )}
        </Pressable>
        <Text variant="caption" color="textMuted">
          {t('form.galleryHint', { count: s.gallery.length, max: MAX_GALLERY_PHOTOS })}
        </Text>
        <Row wrap gap={spacing.sm}>
          {s.gallery.map((p, i) => (
            <View key={`${p.uri}-${i}`}>
              <Image source={{ uri: p.uri }} style={[styles.thumb, { borderRadius: radius.md }]} contentFit="cover" />
              <View style={styles.thumbRemove}>
                <IconButton icon="close-circle" label={t('form.removePhoto')} color="danger" size={20} background={colors.surface} onPress={() => set('gallery', s.gallery.filter((_, j) => j !== i))} />
              </View>
            </View>
          ))}
          {s.gallery.length < MAX_GALLERY_PHOTOS ? (
            <Pressable
              onPress={() => addPhotos('gallery')}
              accessibilityRole="button"
              accessibilityLabel={t('form.addPhotos')}
              style={[styles.thumb, styles.addThumb, { borderColor: colors.border, borderRadius: radius.md }]}
            >
              <Icon name="add" size={28} color="primary" />
            </Pressable>
          ) : null}
        </Row>
        {err('gallery') ? <Text color="danger">{err('gallery')}</Text> : null}
      </Section>

      {/* Where */}
      <Section title={t('form.where')}>
        <Text variant="caption" style={{ fontWeight: '600' }}>
          {t('filters.city')}
        </Text>
        <Row wrap gap={spacing.sm}>
          {(cities ?? []).map((c) => (
            <Chip key={c.slug} label={l.cityName(c.slug)} selected={s.city === c.slug} onPress={() => set('city', c.slug)} />
          ))}
        </Row>
        <TextField label={t('form.area')} value={s.area} onChangeText={(v) => set('area', v)} placeholder={t('form.areaPlaceholder')} />
        <Card>
          <Row gap={spacing.md}>
            <Icon name="location" size={24} color={s.meetingPoint ? 'accent' : 'textMuted'} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{t('event.meetingPoint')}</Text>
              <Text variant="small" color={err('meetingPoint') ? 'danger' : 'textMuted'}>
                {s.meetingPoint ? `${s.meetingPoint.lat.toFixed(5)}, ${s.meetingPoint.lng.toFixed(5)}` : (err('meetingPoint') ?? t('form.noPointYet'))}
              </Text>
            </View>
            <Button title={s.meetingPoint ? t('form.change') : t('form.pickOnMap')} size="sm" variant="secondary" onPress={() => setPicker('meeting')} />
          </Row>
        </Card>
        <TextField
          label={t('form.meetingAddress')}
          value={s.meetingAddress}
          onChangeText={(v) => set('meetingAddress', v)}
          error={err('meetingAddress')}
          placeholder={t('form.meetingAddressPlaceholder')}
        />

        <Text variant="caption" style={{ fontWeight: '600' }}>
          {t('form.stops')}
        </Text>
        {s.stops.map((stop, i) => (
          <Row key={`${stop.lat},${stop.lng},${i}`} gap={spacing.xs}>
            <Text variant="bodyStrong" style={{ width: 22 }}>
              {i + 1}
            </Text>
            <View style={{ flex: 1 }}>
              <TextField
                label={t('form.stopName', { n: i + 1 })}
                value={stop.name}
                onChangeText={(v) => set('stops', s.stops.map((x, j) => (j === i ? { ...x, name: v } : x)))}
              />
            </View>
            <IconButton icon="arrow-up" label={t('form.moveUp')} onPress={() => moveStop(i, -1)} />
            <IconButton icon="arrow-down" label={t('form.moveDown')} onPress={() => moveStop(i, 1)} />
            <IconButton icon="trash-outline" label={t('form.removeStop')} color="danger" onPress={() => set('stops', s.stops.filter((_, j) => j !== i))} />
          </Row>
        ))}
        {err('stops') ? <Text color="danger">{err('stops')}</Text> : null}
        <Button title={t('form.addStop')} icon="add" variant="ghost" size="sm" onPress={() => setPicker('stop')} />
      </Section>

      {/* When */}
      <Section title={t('form.when')}>
        <DateField label={t('form.start')} value={s.startAt} onChange={(d) => set('startAt', d)} minimumDate={new Date()} error={err('startAt')} />
        {isMultiDay ? (
          <DateField label={t('form.end')} value={s.endAt} onChange={(d) => set('endAt', d)} minimumDate={s.startAt ?? new Date()} error={err('endAt')} />
        ) : (
          <Row gap={spacing.md}>
            <View style={{ flex: 1 }}>
              <TextField label={t('form.hours')} keyboardType="number-pad" value={s.hours} onChangeText={(v) => set('hours', v)} error={err('durationMinutes')} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label={t('form.minutes')} keyboardType="number-pad" value={s.minutes} onChangeText={(v) => set('minutes', v)} />
            </View>
          </Row>
        )}
        {durationMinutes > 0 ? (
          <Text variant="small" color="textMuted">
            {t('event.duration')}: {l.duration(durationMinutes)}
          </Text>
        ) : null}
      </Section>

      {/* Details */}
      <Section title={t('form.details')}>
        <Text variant="caption" style={{ fontWeight: '600' }}>
          {t('filters.difficulty')}
        </Text>
        <SegmentedControl value={s.difficulty} onChange={(v) => set('difficulty', v)} options={DIFFICULTIES.map((d) => ({ value: d, label: l.difficulty(d) }))} />
        <TextField label={t('form.distanceKm')} keyboardType="decimal-pad" value={s.distanceKm} onChangeText={(v) => set('distanceKm', v)} error={err('distanceKm')} />
        <Text variant="caption" style={{ fontWeight: '600' }}>
          {t('event.languages')}
        </Text>
        <Row wrap gap={spacing.sm}>
          {EVENT_LANGUAGES.map((code) => (
            <Chip
              key={code}
              label={l.language(code)}
              selected={s.languages.includes(code)}
              onPress={() => set('languages', s.languages.includes(code) ? s.languages.filter((x) => x !== code) : [...s.languages, code])}
            />
          ))}
        </Row>
        {err('languages') ? <Text color="danger">{err('languages')}</Text> : null}
        <ToggleRow label={t('events.womenOnly')} hint={t('form.womenOnlyHint')} value={s.womenOnly} onChange={(v) => set('womenOnly', v)} />
        <ToggleRow label={t('events.familyFriendly')} value={s.familyFriendly} onChange={(v) => set('familyFriendly', v)} />
      </Section>

      {/* Price & capacity */}
      <Section title={t('form.priceCapacity')}>
        <Row gap={spacing.md}>
          <View style={{ flex: 1 }}>
            <TextField label={t('form.priceEgp')} keyboardType="number-pad" value={s.priceEgp} onChangeText={(v) => set('priceEgp', v)} error={err('priceEgp')} hint={t('form.priceHint')} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label={t('form.capacity')} keyboardType="number-pad" value={s.capacity} onChangeText={(v) => set('capacity', v)} error={err('capacity')} />
          </View>
        </Row>
        <TextField label={t('event.includes')} value={s.includes} onChangeText={(v) => set('includes', v)} placeholder={t('form.includesPlaceholder')} />
        <Text variant="caption" style={{ fontWeight: '600' }}>
          {t('event.approval')}
        </Text>
        <SegmentedControl
          value={s.approvalMode}
          onChange={(v) => set('approvalMode', v)}
          options={[
            { value: 'auto', label: t('event.autoApproval') },
            { value: 'manual', label: t('event.manualApproval') },
          ]}
        />
      </Section>

      {/* Good to know */}
      <Section title={t('form.goodToKnow')}>
        <TextField label={t('event.whatToBring')} value={s.whatToBring} onChangeText={(v) => set('whatToBring', v)} multiline />
        <TextField label={t('event.cancellationPolicy')} value={s.cancellationPolicy} onChangeText={(v) => set('cancellationPolicy', v)} multiline />
      </Section>

      <LocationPicker
        visible={picker !== null}
        title={picker === 'stop' ? t('form.addStop') : t('form.pickMeetingPoint')}
        initial={picker === 'meeting' ? s.meetingPoint : (s.stops.at(-1) ?? s.meetingPoint)}
        onClose={() => setPicker(null)}
        onPick={(loc) => {
          if (picker === 'meeting') {
            setS((p) => ({ ...p, meetingPoint: { lat: loc.lat, lng: loc.lng }, meetingAddress: p.meetingAddress || loc.address || '' }));
          } else {
            setS((p) => ({ ...p, stops: [...p.stops, { name: loc.name ?? loc.address ?? t('form.stopName', { n: p.stops.length + 1 }), lat: loc.lat, lng: loc.lng }] }));
          }
          setPicker(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: { height: 180, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumb: { width: 84, height: 84 },
  addThumb: { borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  thumbRemove: { position: 'absolute', top: -14, end: -14 },
});
