import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Shot } from '@/src/models/shot';
import { KataTemplate } from '@/src/models/template';
import { getTemplate, listShots } from '@/src/storage/repository';

export default function TemplateDetailScreen() {
  const router = useRouter();
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const [template, setTemplate] = useState<KataTemplate | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);

  const load = useCallback(async () => {
    if (!templateId) return;
    const [templateData, shotData] = await Promise.all([getTemplate(templateId), listShots(templateId)]);
    setTemplate(templateData ?? null);
    setShots(shotData);
  }, [templateId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!template) {
    return (
      <View style={styles.center}>
        <Text>型が見つかりません。</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={{ uri: template.referenceImagePath }} style={styles.referenceImage} />
      <Text style={styles.name}>{template.name}</Text>
      <Text style={styles.meta}>{new Date(template.createdAt).toLocaleString()}</Text>

      <Pressable onPress={() => router.push(`/camera/${template.id}`)} style={styles.button}>
        <Text style={styles.buttonText}>この型で撮る</Text>
      </Pressable>

      <Text style={styles.section}>この型の撮影一覧</Text>
      <FlatList
        data={shots}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.emptyText}>まだ撮影はありません。</Text>}
        renderItem={({ item }) => (
          <View style={styles.shotRow}>
            <Text numberOfLines={1} style={styles.shotText}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
            <Text>{item.favorite ? '★' : '☆'}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  referenceImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
  },
  meta: {
    color: '#6b7280',
    fontSize: 12,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  section: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: '#6b7280',
    marginTop: 8,
  },
  shotRow: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shotText: {
    flex: 1,
    marginRight: 8,
  },
});
