import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { Template } from '@/src/models/template';
import { listTemplates } from '@/src/storage/templates';

const GUTTER = 12;
const CARD_ASPECT_RATIO = 4 / 5;

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [templates, setTemplates] = useState<Template[]>([]);

  const cardWidth = useMemo(() => (width - GUTTER * 3) / 2, [width]);

  const loadTemplates = useCallback(async () => {
    try {
      const data = await listTemplates();
      setTemplates(data);
    } catch {
      setTemplates([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTemplates();
    }, [loadTemplates])
  );

  return (
    <SafeAreaView style={styles.container}>
      {templates.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="images-outline" size={40} color="#9CA3AF" />
          <Text style={styles.emptyStateText}>まだ型がありません</Text>
          <Text style={styles.emptyStateSubText}>右下の＋から追加してください</Text>
        </View>
      ) : (
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/template/${item.id}`)}
              style={[styles.card, { width: cardWidth, aspectRatio: CARD_ASPECT_RATIO }]}
            >
              <Image source={{ uri: item.overlayPngUri }} style={styles.cardImage} resizeMode="cover" />
            </Pressable>
          )}
        />
      )}

      <Pressable onPress={() => router.push('/template/create')} style={styles.fab}>
        <Ionicons name="add" size={34} color="#FFFFFF" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: GUTTER,
    paddingTop: GUTTER,
    paddingBottom: 136,
    gap: GUTTER,
  },
  columnWrapper: {
    gap: GUTTER,
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 44,
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 5,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 10,
  },
  emptyStateText: {
    color: '#0B1220',
    fontSize: 18,
    fontWeight: '600',
  },
  emptyStateSubText: {
    color: '#6B7280',
    fontSize: 14,
  },
});
