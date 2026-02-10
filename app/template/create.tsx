import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';

import { Template } from '@/src/models/template';
import { IMAGES_DIR, addTemplate, ensureStorageReady } from '@/src/storage/repository';

export default function CreateTemplateScreen() {
  const router = useRouter();
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const pickImage = async () => {
    try {
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
    } catch {
      Alert.alert('エラー', '画像の選択に失敗しました。');
    }
  };

  const saveTemplate = async () => {
    if (!selectedUri || isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      await ensureStorageReady();
      const id = `${Date.now()}`;
      const destination = `${IMAGES_DIR}${id}.jpg`;
      await FileSystem.copyAsync({ from: selectedUri, to: destination });

      const template: Template = {
        id,
        createdAt: new Date().toISOString(),
        imageUri: destination,
      };

      await addTemplate(template);
      router.replace('/');
    } catch {
      Alert.alert('エラー', '保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={pickImage} style={styles.pickButton}>
          <Text style={styles.pickButtonText}>写真を選択</Text>
        </Pressable>

        {selectedUri ? <Image source={{ uri: selectedUri }} style={styles.previewImage} resizeMode="cover" /> : null}

        {selectedUri ? (
          <Pressable onPress={saveTemplate} disabled={isSaving} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>{isSaving ? '保存中...' : '保存'}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 160,
    gap: 16,
  },
  pickButton: {
    minHeight: 64,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  previewImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
  saveButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
