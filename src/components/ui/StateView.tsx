import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorKey } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export function LoadingView({ label }: { label?: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label ?? t('common.loading')}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function EmptyView({
  icon = 'compass-outline',
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { spacing } = useTheme();
  return (
    <View style={[styles.center, { gap: spacing.md, padding: spacing.xl }]}>
      <Icon name={icon} size={48} color="textMuted" />
      <Text variant="heading" align="center">
        {title}
      </Text>
      {message ? (
        <Text color="textMuted" align="center">
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  return (
    <View style={[styles.center, { gap: spacing.md, padding: spacing.xl }]} accessibilityRole="alert">
      <Icon name="cloud-offline-outline" size={48} color="danger" />
      <Text variant="heading" align="center">
        {t('common.somethingWrong')}
      </Text>
      <Text color="textMuted" align="center">
        {t(errorKey(error))}
      </Text>
      {onRetry ? <Button title={t('common.retry')} variant="secondary" icon="refresh" onPress={onRetry} /> : null}
    </View>
  );
}

/** Renders loading / error / empty states for a query, or the children when there is data. */
export function QueryState<T>({
  query,
  isEmpty,
  empty,
  children,
}: {
  query: { data: T | undefined; isLoading: boolean; error: unknown; refetch: () => unknown };
  isEmpty?: (data: T) => boolean;
  empty?: React.ReactNode;
  children: (data: T) => React.ReactNode;
}) {
  if (query.isLoading) return <LoadingView />;
  if (query.error || query.data === undefined) return <ErrorView error={query.error} onRetry={() => query.refetch()} />;
  if (isEmpty?.(query.data) && empty) return <>{empty}</>;
  return <>{children(query.data)}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
});
