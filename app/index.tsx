import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { KataTemplate } from '@/src/models/template';
import { listTemplates } from '@/src/storage/repository';

export default function HomeScreen() {
  const router = useRouter();
  const [templates, setTemplates] = useState<KataTemplate[]>([]);

  const loadTemplates = useCallback(async () => {
    const data = await listTemplates();
    setTemplates(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTemplates();
    }, [loadTemplates])
  );

  const latestTemplate = templates[0];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FRAME</Text>

      <Pressable
        disabled={!latestTemplate}
        onPress={() => latestTemplate && router.push(`/camera/${latestTemplate.id}`)}
        style={[styles.primaryButton, !latestTemplate && styles.buttonDisabled]}>
        <Text style={styles.primaryButtonText}>この型で撮る</Text>
      </Pressable>

      <Pressable onPress={() => router.push('/template/create')} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>型を作る</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>型一覧（最新順）</Text>
      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.emptyText}>まだ型がありません。</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/template/${item.id}`)} style={styles.templateCard}>
            <Text style={styles.templateName}>{item.name}</Text>
            <Text style={styles.templateDate}>{new Date(item.createdAt).toLocaleString()}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  sectionTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: '#6b7280',
    marginTop: 12,
  },
  templateCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
  },
  templateDate: {
    marginTop: 4,
    color: '#6b7280',
    fontSize: 12,
  },
});
