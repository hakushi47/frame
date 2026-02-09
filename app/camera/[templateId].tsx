import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { KataTemplate } from '@/src/models/template';
import { getTemplate } from '@/src/storage/repository';

export default function CameraScreen() {
  const router = useRouter();
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [template, setTemplate] = useState<KataTemplate | null>(null);

  useEffect(() => {
    if (!templateId) return;
    void getTemplate(templateId).then((data) => setTemplate(data ?? null));
  }, [templateId]);

  useEffect(() => {
    if (!permission?.granted) {
      void requestPermission();
    }
  }, [permission?.granted, requestPermission]);

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text>カメラ権限を確認中...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>カメラのアクセスを許可してください。</Text>
        <Pressable onPress={requestPermission} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>許可する</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={StyleSheet.absoluteFillObject} facing="back" />

      {template?.referenceImagePath ? (
        <Image source={{ uri: template.referenceImagePath }} style={styles.overlay} />
      ) : null}

      <View style={styles.bottomBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>戻る</Text>
        </Pressable>

        <Pressable style={styles.shutterOuter}>
          <View style={styles.shutterInner} />
        </Pressable>

        <View style={styles.placeholder} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  permissionText: {
    marginBottom: 12,
  },
  permissionButton: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
    resizeMode: 'cover',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 30,
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  backButton: {
    minWidth: 56,
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  shutterOuter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  placeholder: {
    width: 56,
  },
});
