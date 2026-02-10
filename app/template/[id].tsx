import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Template } from '@/src/models/template';
import { deleteTemplate, getTemplate } from '@/src/storage/repository';

export default function TemplateDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [template, setTemplate] = useState<Template | null>(null);

  const loadTemplate = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getTemplate(id);
      setTemplate(data ?? null);
    } catch {
      Alert.alert('エラー', '型の読み込みに失敗しました。');
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadTemplate();
    }, [loadTemplate])
  );

  const handleDelete = () => {
    if (!template) return;

    Alert.alert('削除しますか？', 'この型を削除すると元に戻せません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTemplate(template.id);
            router.replace('/');
          } catch {
            Alert.alert('エラー', '削除に失敗しました。');
          }
        },
      },
    ]);
  };

  if (!template) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <Text style={styles.emptyText}>型が見つかりません。</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Image source={{ uri: template.imageUri }} style={styles.previewImage} resizeMode="cover" />

        <Pressable onPress={() => router.push(`/camera/${template.id}`)} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>撮影する</Text>
        </Pressable>

        <Pressable onPress={handleDelete} style={styles.outlineButton}>
          <Text style={styles.outlineButtonText}>型を削除</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    gap: 16,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 16,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButtonText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  emptyText: {
    color: '#0B1220',
    fontSize: 16,
  },
});
