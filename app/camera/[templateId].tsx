import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  GestureResponderEvent,
  Image,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Template } from '@/src/models/template';
import { SHOTS_DIR, addShot, ensureStorageReady, getTemplate } from '@/src/storage/repository';

const MIN_OPACITY = 0.2;
const MAX_OPACITY = 0.85;
const TIMER_OPTIONS = [0, 3, 5, 10] as const;
const SLIDER_HEIGHT = 180;

export default function CameraScreen() {
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [template, setTemplate] = useState<Template | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [opacity, setOpacity] = useState(0.6);
  const [timerIndex, setTimerIndex] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sliderHeight, setSliderHeight] = useState(SLIDER_HEIGHT);

  const timerSeconds = TIMER_OPTIONS[timerIndex];
  const controlsDisabled = isCapturing || countdown !== null;

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

  const handleCapture = async () => {
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

  const handleShutterPress = async () => {
    if (controlsDisabled) {
      return;
    }

    if (!timerSeconds) {
      await handleCapture();
      return;
    }

    setCountdown(timerSeconds);
  };

  useEffect(() => {
    if (countdown === null) {
      return;
    }

    if (countdown <= 1) {
      const timer = setTimeout(() => {
        setCountdown(null);
        void handleCapture();
      }, 1000);

      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => (prev === null ? null : prev - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  const updateOpacityFromTouch = (event: GestureResponderEvent) => {
    const locationY = event.nativeEvent.locationY;
    const clamped = Math.max(0, Math.min(sliderHeight, locationY));
    const progress = 1 - clamped / sliderHeight;
    const nextOpacity = MIN_OPACITY + progress * (MAX_OPACITY - MIN_OPACITY);
    setOpacity(Number(nextOpacity.toFixed(3)));
  };

  const sliderPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          updateOpacityFromTouch(event);
        },
        onPanResponderMove: (event) => {
          updateOpacityFromTouch(event);
        },
      }),
    [sliderHeight]
  );

  const handleSliderLayout = (event: LayoutChangeEvent) => {
    setSliderHeight(event.nativeEvent.layout.height || SLIDER_HEIGHT);
  };

  const sliderProgress = (opacity - MIN_OPACITY) / (MAX_OPACITY - MIN_OPACITY);

  if (!permission) {
    return <View style={styles.root} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionRoot}>
        <Stack.Screen options={{ headerShown: false }} />
        <Pressable style={styles.permissionButton} onPress={() => void requestPermission()}>
          <Text style={styles.permissionButtonText}>カメラを許可</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <CameraView ref={cameraRef} style={[StyleSheet.absoluteFill, mirror && styles.mirror]} facing="back" />

      {template?.imageUri ? (
        <Image
          source={{ uri: template.imageUri }}
          style={[styles.overlay, { opacity }, mirror && styles.mirror]}
          resizeMode="cover"
          pointerEvents="none"
        />
      ) : null}

      {countdown !== null ? (
        <Pressable style={styles.countdownOverlay} onPress={() => setCountdown(null)}>
          <Text style={styles.countdownText}>{countdown}</Text>
        </Pressable>
      ) : null}

      <View pointerEvents="box-none" style={styles.controlsOverlay}>
        <View style={styles.rightControls}>
          <Pressable
            style={[styles.iconButton, mirror && styles.iconButtonActive]}
            onPress={() => setMirror((prev) => !prev)}
            disabled={controlsDisabled}
          >
            <Ionicons name={mirror ? 'swap-horizontal' : 'swap-horizontal-outline'} size={24} color="#FFFFFF" />
          </Pressable>

          <View
            style={[styles.sliderWrap, controlsDisabled && styles.disabled]}
            onLayout={handleSliderLayout}
            {...sliderPanResponder.panHandlers}
          >
            <View style={styles.sliderTrack} />
            <View style={[styles.sliderFill, { height: `${sliderProgress * 100}%` }]} />
            <View style={[styles.sliderThumb, { bottom: `${sliderProgress * 100}%` }]} />
          </View>

          <Pressable
            style={[styles.iconButton, timerSeconds > 0 && styles.iconButtonActive]}
            onPress={() => setTimerIndex((prev) => (prev + 1) % TIMER_OPTIONS.length)}
            disabled={controlsDisabled}
          >
            <Ionicons name={timerSeconds > 0 ? 'timer' : 'timer-outline'} size={24} color="#FFFFFF" />
            {timerSeconds > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{timerSeconds}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <Pressable onPress={() => void handleShutterPress()} style={styles.shutterOuter} disabled={controlsDisabled}>
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
  permissionRoot: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionButton: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  mirror: {
    transform: [{ scaleX: -1 }],
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 34,
  },
  rightControls: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -140,
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  sliderWrap: {
    width: 44,
    height: SLIDER_HEIGHT,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  sliderTrack: {
    position: 'absolute',
    width: 4,
    top: 14,
    bottom: 14,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  sliderFill: {
    position: 'absolute',
    width: 4,
    bottom: 14,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  sliderThumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    marginBottom: 5,
    backgroundColor: '#FFFFFF',
  },
  badge: {
    position: 'absolute',
    right: -2,
    top: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '700',
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
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  countdownText: {
    color: '#FFFFFF',
    fontSize: 120,
    fontWeight: '700',
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
});
