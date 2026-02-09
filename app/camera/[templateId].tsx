import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { KataTemplate } from '@/src/models/template';
import { getTemplate } from '@/src/storage/repository';

export default function CameraScreen() {
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [template, setTemplate] = useState<KataTemplate | null>(null);
  const [, setCapturedPhotoUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (!templateId) return;
    void getTemplate(templateId).then((data) => setTemplate(data ?? null));
  }, [templateId]);

  useEffect(() => {
    if (!permission?.granted) {
      void requestPermission();
    }
  }, [permission?.granted, requestPermission]);

  const takePicture = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync();
    if (photo?.uri) {
      setCapturedPhotoUri(photo.uri);
    }
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <Stack.Screen options={{ headerShown: false }} />

      {permission?.granted ? <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" /> : null}

      {template?.referenceImagePath ? (
        <Image
          pointerEvents="none"
          source={{ uri: template.referenceImagePath }}
          style={styles.overlay}
          resizeMode="cover"
        />
      ) : null}


      <Pressable onPress={takePicture} style={styles.shutterOuter}>
        <View style={styles.shutterInner} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  shutterOuter: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
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
});
