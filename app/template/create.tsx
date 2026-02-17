import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { createPendingTemplateImage } from '@/src/template/pendingTemplateImageStore';

type SelectedImage = {
  previewUri: string;
  base64: string;
  mimeType: string;
};

export default function CreateTemplateScreen() {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);

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
        base64: true,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const selected = result.assets[0];
      if (!selected.base64) {
        Alert.alert('エラー', '画像データの取得に失敗しました。');
        return;
      }

      setSelectedImage({
        previewUri: selected.uri,
        base64: selected.base64,
        mimeType: selected.mimeType ?? 'image/jpeg',
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      Alert.alert('エラー', `画像の選択に失敗しました: ${detail}`);
    }
  };

  const onPressGenerate = () => {
    if (!selectedImage) {
      return;
    }

    const pendingId = createPendingTemplateImage({
      previewUri: selectedImage.previewUri,
      base64: selectedImage.base64,
      mimeType: selectedImage.mimeType,
    });

    router.push({
      pathname: '/template/result2',
      params: { pendingId },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Pressable onPress={pickImage} style={styles.pickButton}>
          <Text style={styles.pickButtonText}>写真を選択</Text>
        </Pressable>

        <Pressable
          onPress={onPressGenerate}
          disabled={!selectedImage}
          style={[styles.generateButton, !selectedImage && styles.generateButtonDisabled]}
        >
          <Text style={styles.generateButtonText}>生成する</Text>
        </Pressable>
      </View>
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
    padding: 16,
    justifyContent: 'center',
    gap: 16,
  },
  pickButton: {
    minHeight: 72,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  generateButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
