import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { Template } from '@/src/models/template';
import { createOutlineWebViewHtml } from '@/src/template/outlineWebViewHtml';
import { TEMPLATE_IMAGES_DIR, addTemplate, ensureTemplateStorageReady } from '@/src/storage/templates';

type PendingImage = {
  base64: string;
  mimeType: string;
};

export default function CreateTemplateScreen() {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const [isWebViewReady, setIsWebViewReady] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [sourcePreviewUri, setSourcePreviewUri] = useState<string | null>(null);
  const [outlineDataUrl, setOutlineDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const requestOutline = useCallback(
    (image: PendingImage) => {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: 'RUN_OUTLINE',
          base64: image.base64,
          mimeType: image.mimeType,
        })
      );
    },
    []
  );

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

      const nextPending = {
        base64: selected.base64,
        mimeType: selected.mimeType ?? 'image/jpeg',
      };

      setSourcePreviewUri(selected.uri);
      setOutlineDataUrl(null);
      setPendingImage(nextPending);
      setIsGenerating(true);

      if (isWebViewReady) {
        requestOutline(nextPending);
      }
    } catch {
      setIsGenerating(false);
      Alert.alert('エラー', '画像の選択に失敗しました。');
    }
  };

  const onWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data) as
          | { type: 'READY' }
          | { type: 'OUTLINE_RESULT'; dataUrl?: string }
          | { type: 'OUTLINE_ERROR'; message?: string };

        if (message.type === 'READY') {
          setIsWebViewReady(true);
          if (pendingImage) {
            requestOutline(pendingImage);
          }
          return;
        }

        if (message.type === 'OUTLINE_RESULT' && message.dataUrl) {
          setOutlineDataUrl(message.dataUrl);
          setIsGenerating(false);
          return;
        }

        if (message.type === 'OUTLINE_ERROR') {
          setIsGenerating(false);
          Alert.alert('生成エラー', message.message ?? '型の生成に失敗しました。ネットワーク環境を確認してください。');
        }
      } catch {
        setIsGenerating(false);
        Alert.alert('エラー', '生成結果の読み取りに失敗しました。');
      }
    },
    [pendingImage, requestOutline]
  );

  const saveTemplate = async () => {
    if (!outlineDataUrl || isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      await ensureTemplateStorageReady();

      const id = `${Date.now()}`;
      const destination = `${TEMPLATE_IMAGES_DIR}${id}.png`;
      const base64 = outlineDataUrl.split(',')[1];

      if (!base64) {
        throw new Error('png base64 is empty');
      }

      await FileSystem.writeAsStringAsync(destination, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const template: Template = {
        id,
        createdAt: Date.now(),
        overlayPngUri: destination,
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
      <WebView ref={webViewRef} source={{ html: createOutlineWebViewHtml() }} onMessage={onWebViewMessage} style={styles.hiddenWebView} originWhitelist={['*']} javaScriptEnabled />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={pickImage} style={styles.pickButton}>
          <Text style={styles.pickButtonText}>写真を選択</Text>
        </Pressable>

        {sourcePreviewUri ? (
          <View style={styles.sourcePreviewCard}>
            <Text style={styles.sectionTitle}>選択した写真</Text>
            <Image source={{ uri: sourcePreviewUri }} style={styles.previewImage} resizeMode="cover" />
          </View>
        ) : null}

        <View style={styles.outlinePreviewCard}>
          <Text style={styles.sectionTitle}>生成プレビュー（透明背景の線PNG）</Text>
          <View style={styles.outlinePreviewCanvas}>
            {outlineDataUrl ? <Image source={{ uri: outlineDataUrl }} style={styles.previewImage} resizeMode="contain" /> : <Text style={styles.placeholderText}>{isGenerating ? '型を生成中...' : '写真を選択すると外周線を生成します'}</Text>}
          </View>
        </View>

        {outlineDataUrl ? (
          <Pressable onPress={saveTemplate} disabled={isSaving || isGenerating} style={styles.saveButton}>
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
  hiddenWebView: {
    width: 1,
    height: 1,
    opacity: 0.01,
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
  sourcePreviewCard: {
    gap: 10,
  },
  outlinePreviewCard: {
    gap: 10,
  },
  sectionTitle: {
    color: '#0B1220',
    fontSize: 14,
    fontWeight: '600',
  },
  previewImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
  },
  outlinePreviewCanvas: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 12,
  },
  placeholderText: {
    color: '#6B7280',
    fontSize: 14,
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
