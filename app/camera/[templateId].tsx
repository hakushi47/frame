import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';

import { Template } from '@/src/models/template';
import { SHOTS_DIR, addShot, ensureStorageReady, getTemplate } from '@/src/storage/repository';

export default function CameraScreen() {
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [template, setTemplate] = useState<Template | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!templateId) {
        return;
      }

      try {
        const data = await getTemplate(templateId);
        setTemplate(data ?? null);
      } catch {
        Alert.alert('エラー', '型の読み込みに失敗しました。');
      }
    };

    void load();
  }, [templateId]);

  useEffect(() => {
    if (!permission?.granted) {
      void requestPermission();
    }
  }, [permission?.granted, requestPermission]);

  const handleShutterPress = async () => {
    if (!cameraRef.current || !templateId || isCapturing) {
      return;
    }

    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });

      if (!photo?.uri) {
        return;
      }

      await ensureStorageReady();

      const shotId = `${Date.now()}`;
      const destination = `${SHOTS_DIR}${shotId}.jpg`;
      await FileSystem.copyAsync({ from: photo.uri, to: destination });

      await addShot({
        id: shotId,
        templateId,
        imagePath: destination,
        createdAt: new Date().toISOString(),
        favorite: false,
      });

      Alert.alert('保存しました');
    } catch {
      Alert.alert('エラー', '撮影に失敗しました。');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {template?.imageUri ? (
        <Image
          source={{ uri: template.imageUri }}
          style={styles.overlay}
          resizeMode="cover"
        />
      ) : null}

      <View pointerEvents="box-none" style={styles.controlsOverlay}>
        <Pressable onPress={handleShutterPress} style={styles.shutterOuter}>
          <View style={styles.shutterInner} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.6,
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 34,
  },
  shutterOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderColor: '#FFFFFF',
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
  },
});
