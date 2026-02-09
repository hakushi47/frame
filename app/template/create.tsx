import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { KataTemplate } from '@/src/models/template';
import { addTemplate, IMAGES_DIR, ensureStorageReady } from '@/src/storage/repository';

function buildAutoName(date: Date) {
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  const hh = `${date.getHours()}`.padStart(2, '0');
  const min = `${date.getMinutes()}`.padStart(2, '0');
  return `型 ${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export default function CreateTemplateScreen() {
  const router = useRouter();
  const [selectedUri, setSelectedUri] = useState<string | null>(null);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('権限エラー', '写真ライブラリへのアクセスを許可してください。');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setSelectedUri(result.assets[0].uri);
    }
  };

  const saveTemplate = async () => {
    if (!selectedUri) {
      Alert.alert('未選択', '見本画像を選択してください。');
      return;
    }

    await ensureStorageReady();
    const id = `${Date.now()}`;
    const destination = `${IMAGES_DIR}${id}.jpg`;
    await FileSystem.copyAsync({ from: selectedUri, to: destination });

    const now = new Date();
    const template: KataTemplate = {
      id,
      name: buildAutoName(now),
      referenceImagePath: destination,
      createdAt: now.toISOString(),
    };

    await addTemplate(template);
    router.replace(`/template/${template.id}`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <Pressable onPress={pickImage} style={styles.pickButton}>
        <Text style={styles.pickButtonText}>写真を選択</Text>
      </Pressable>

      {selectedUri ? <Image source={{ uri: selectedUri }} style={styles.preview} /> : null}

      <Pressable onPress={saveTemplate} style={styles.saveButton}>
        <Text style={styles.saveButtonText}>保存</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 120,
    gap: 12,
  },
  pickButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pickButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  preview: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  saveButton: {
    marginTop: 8,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
