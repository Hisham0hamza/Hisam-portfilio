import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  );
}

export function Avatar({ uri, name, size = 40 }: { uri?: string | null; name: string; size?: number }) {
  const { colors } = useTheme();
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[style, { backgroundColor: colors.surfaceAlt }]}
        contentFit="cover"
        transition={150}
        accessibilityLabel={name}
      />
    );
  }
  return (
    <View style={[style, styles.fallback, { backgroundColor: colors.primarySoft }]} accessibilityLabel={name}>
      <Text variant={size > 48 ? 'heading' : 'small'} color="primary">
        {initials(name)}
      </Text>
    </View>
  );
}

export function AvatarStack({ people, max = 6, size = 32 }: { people: { id: string; name: string; avatar_url: string | null }[]; max?: number; size?: number }) {
  const { colors } = useTheme();
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <View style={styles.stack} accessibilityLabel={people.map((p) => p.name).join(', ')} accessible>
      {shown.map((p, i) => (
        <View key={p.id} style={{ marginStart: i === 0 ? 0 : -size / 3, borderRadius: size, borderWidth: 2, borderColor: colors.surface }}>
          <Avatar uri={p.avatar_url} name={p.name} size={size} />
        </View>
      ))}
      {extra > 0 ? (
        <View
          style={[
            styles.fallback,
            { marginStart: -size / 3, width: size + 4, height: size + 4, borderRadius: size, backgroundColor: colors.surfaceAlt, borderWidth: 2, borderColor: colors.surface },
          ]}
        >
          <Text variant="small">+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  stack: { flexDirection: 'row', alignItems: 'center' },
});
