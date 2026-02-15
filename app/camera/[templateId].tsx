import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Template } from '@/src/models/template';
import { getTemplate } from '@/src/storage/templates';
import { SHOTS_DIR, addShot, ensureStorageReady } from '@/src/storage/repository';

const MIN_OPACITY = 0.2;
const MAX_OPACITY = 0.85;
const DEFAULT_OPACITY = 0.6;
const TIMER_OPTIONS = [0, 3, 5, 10] as const;
const SLIDER_WIDTH = 260;

export default function CameraScreen() {
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [template, setTemplate] = useState<Template | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [opacity, setOpacity] = useState(DEFAULT_OPACITY);
  const [timerIndex, setTimerIndex] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isSliderVisible, setIsSliderVisible] = useState(false);
  const [sliderWidth, setSliderWidth] = useState(SLIDER_WIDTH);

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
    const locationX = event.nativeEvent.locationX;
    const clamped = Math.max(0, Math.min(sliderWidth, locationX));
    const progress = clamped / sliderWidth;
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
    [sliderWidth]
  );

  const handleSliderLayout = (event: LayoutChangeEvent) => {
    setSliderWidth(event.nativeEvent.layout.width || SLIDER_WIDTH);
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
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {template?.overlayPngUri ? (
        <Image
          source={{ uri: template.overlayPngUri }}
          style={[styles.overlay, { opacity }, mirror && styles.mirror]}
          resizeMode="cover"
          pointerEvents="none"
        />
      ) : null}

      {isSliderVisible ? (
        <Pressable style={styles.sliderDismissArea} onPress={() => setIsSliderVisible(false)} disabled={controlsDisabled} />
      ) : null}

      {countdown !== null ? (
        <View style={styles.countdownOverlay} pointerEvents="none">
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      ) : null}

      <View pointerEvents="box-none" style={styles.controlsOverlay}>
        <View style={[styles.topBar, { top: insets.top + 10 }, controlsDisabled && styles.disabled]}>
          <Pressable
            style={[styles.iconButton, timerSeconds > 0 && styles.iconButtonActive]}
            onPress={() => setTimerIndex((prev) => (prev + 1) % TIMER_OPTIONS.length)}
            disabled={controlsDisabled}
          >
            <Ionicons name={timerSeconds > 0 ? 'timer' : 'timer-outline'} size={22} color="#FFFFFF" />
            {timerSeconds > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{timerSeconds}</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            style={[styles.iconButton, mirror && styles.iconButtonActive]}
            onPress={() => setMirror((prev) => !prev)}
            disabled={controlsDisabled}
          >
            <Ionicons name={mirror ? 'swap-horizontal' : 'swap-horizontal-outline'} size={22} color="#FFFFFF" />
          </Pressable>

          <Pressable
            style={[styles.iconButton, isSliderVisible && styles.iconButtonActive]}
            onPress={() => setIsSliderVisible((prev) => !prev)}
            disabled={controlsDisabled}
          >
            <Ionicons name="options-outline" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        {isSliderVisible ? (
          <View style={[styles.sliderPanel, { bottom: 150 + insets.bottom }]} pointerEvents="box-none">
            <View style={styles.sliderPanelInner} onLayout={handleSliderLayout} {...sliderPanResponder.panHandlers}>
              <View style={styles.sliderTrack} />
              <View style={[styles.sliderFill, { width: `${sliderProgress * 100}%` }]} />
              <View style={[styles.sliderThumb, { left: `${sliderProgress * 100}%` }]} />
            </View>
          </View>
        ) : null}

        <Pressable onPress={() => void handleShutterPress()} style={[styles.shutterOuter, { bottom: 34 + insets.bottom }]} disabled={controlsDisabled}>
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
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.34)',
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
  sliderDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  sliderPanel: {
    position: 'absolute',
    alignSelf: 'center',
    width: '70%',
  },
  sliderPanelInner: {
    height: 50,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.46)',
    justifyContent: 'center',
    paddingHorizontal: 18,
    position: 'relative',
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  sliderFill: {
    position: 'absolute',
    left: 18,
    top: '50%',
    height: 4,
    marginTop: -2,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  sliderThumb: {
    position: 'absolute',
    top: '50%',
    width: 18,
    height: 18,
    marginTop: -9,
    marginLeft: 10,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },
  shutterOuter: {
    position: 'absolute',
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
    backgroundColor: 'rgba(0,0,0,0.22)',
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
