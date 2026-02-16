import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { Template } from '@/src/models/template';
import { createOutlineWebViewHtml } from '@/src/template/outlineWebViewHtml';
import {
  clearPendingTemplateImage,
  getPendingTemplateImage,
  type PendingTemplateImage,
} from '@/src/template/pendingTemplateImageStore';
import {
  TEMPLATE_IMAGES_DIR,
  addTemplate,
  ensureTemplateStorageReady,
} from '@/src/storage/templates';

type OutlineProcessingOptions = {
  smoothingIterations: number;
  simplifyTolerance: number;
};

const DEFAULT_OUTLINE_OPTIONS: OutlineProcessingOptions = {
  smoothingIterations: 3,
  simplifyTolerance: 2.0,
};

export default function TemplateResultScreen() {
  const router = useRouter();
  const { pendingId } = useLocalSearchParams<{ pendingId?: string }>();
  const webViewRef = useRef<WebView>(null);
  const [pendingImage, setPendingImage] = useState<PendingTemplateImage | null>(null);
  const [isWebViewReady, setIsWebViewReady] = useState(false);
  const [outlineDataUrl, setOutlineDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingId) {
      setIsGenerating(false);
      setGenerationError('選択画像が見つかりませんでした。');
      return;
    }

    const stored = getPendingTemplateImage(pendingId);
    if (!stored) {
      setIsGenerating(false);
      setGenerationError('選択画像の有効期限が切れています。やり直してください。');
      return;
    }

    setPendingImage(stored);
  }, [pendingId]);

  const requestOutline = useCallback((image: PendingTemplateImage) => {
    webViewRef.current?.postMessage(
      JSON.stringify({
        type: 'RUN_OUTLINE',
        base64: image.base64,
        mimeType: image.mimeType,
        options: DEFAULT_OUTLINE_OPTIONS,
      })
    );
  }, []);

  useEffect(() => {
    if (!isWebViewReady || !pendingImage || outlineDataUrl) {
      return;
    }

    setIsGenerating(true);
    requestOutline(pendingImage);
  }, [isWebViewReady, outlineDataUrl, pendingImage, requestOutline]);

  const onWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data) as
          | { type: 'READY' }
          | { type: 'OUTLINE_RESULT'; dataUrl?: string }
          | { type: 'OUTLINE_ERROR'; message?: string };

        if (message.type === 'READY') {
          setIsWebViewReady(true);
          return;
        }

        if (message.type === 'OUTLINE_RESULT' && message.dataUrl) {
          setOutlineDataUrl(message.dataUrl);
          setGenerationError(null);
          setIsGenerating(false);
          if (pendingId) {
            clearPendingTemplateImage(pendingId);
          }
          return;
        }

        if (message.type === 'OUTLINE_ERROR') {
          setIsGenerating(false);
          const detail = message.message ?? '不明なエラーが発生しました';
          setGenerationError(detail);
          Alert.alert('生成に失敗しました', `原因: ${detail}`);
        }
      } catch (error) {
        setIsGenerating(false);
        const detail = error instanceof Error ? error.message : String(error);
        setGenerationError(detail);
        Alert.alert('生成に失敗しました', `原因: ${detail}`);
      }
    },
    [pendingId]
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
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      Alert.alert('エラー', `保存に失敗しました: ${detail}`);
    } finally {
      setIsSaving(false);
    }
  };

  const retry = () => {
    if (pendingId) {
      clearPendingTemplateImage(pendingId);
    }
    router.replace('/template/create');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />

      <WebView
        ref={webViewRef}
        source={{ html: createOutlineWebViewHtml() }}
        onMessage={onWebViewMessage}
        style={styles.hiddenWebView}
        originWhitelist={['*']}
        javaScriptEnabled
      />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
          <Ionicons name="chevron-back" size={22} color="#0B1220" />
          <Text style={styles.backButtonText}>戻る</Text>
        </Pressable>
        <Text style={styles.headerTitle}>生成結果</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.previewOuter}>
        <View style={styles.previewFrame}>
          {isGenerating ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>生成中…</Text>
            </View>
          ) : outlineDataUrl ? (
            <Image source={{ uri: outlineDataUrl }} style={styles.resultImage} resizeMode="contain" />
          ) : (
            <View style={styles.centerContent}>
              <Text style={styles.errorText}>生成に失敗しました{generationError ? `（原因: ${generationError}）` : ''}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={saveTemplate}
          disabled={!outlineDataUrl || isSaving || isGenerating}
          style={[styles.primaryButton, (!outlineDataUrl || isSaving || isGenerating) && styles.buttonDisabled]}
        >
          <Text style={styles.primaryButtonText}>{isSaving ? '保存中...' : '保存'}</Text>
        </Pressable>

        <Pressable onPress={retry} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>やり直す</Text>
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
  hiddenWebView: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 64,
    gap: 2,
  },
  backButtonText: {
    color: '#0B1220',
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    color: '#0B1220',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    minWidth: 64,
  },
  previewOuter: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  previewFrame: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#0B1220',
    fontSize: 16,
    fontWeight: '600',
  },
  resultImage: {
    width: '100%',
    height: '100%',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  primaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
