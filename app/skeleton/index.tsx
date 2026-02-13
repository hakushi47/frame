import * as ImagePicker from 'expo-image-picker';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { createPoseWebViewHtml } from '@/src/pose/webviewHtml';

type PosePoint = {
  x: number;
  y: number;
  visibility?: number | null;
  confidence?: number | null;
};

type PoseKey =
  | 'LEFT_SHOULDER'
  | 'RIGHT_SHOULDER'
  | 'LEFT_ELBOW'
  | 'RIGHT_ELBOW'
  | 'LEFT_WRIST'
  | 'RIGHT_WRIST'
  | 'LEFT_HIP'
  | 'RIGHT_HIP';

type PoseKeypoints = Partial<Record<PoseKey, PosePoint>>;

type NormalizedPoints = Record<PoseKey, { x: number; y: number } | null>;

type Segment = [PoseKey, PoseKey] | ['MID_SHOULDER', 'MID_HIP'];

const DRAW_WIDTH = 300;
const DRAW_HEIGHT = 400;
const SCALE_MULTIPLIER = 70;
const HTML = createPoseWebViewHtml();
const SEGMENTS: Segment[] = [
  ['LEFT_SHOULDER', 'RIGHT_SHOULDER'],
  ['LEFT_SHOULDER', 'LEFT_ELBOW'],
  ['LEFT_ELBOW', 'LEFT_WRIST'],
  ['RIGHT_SHOULDER', 'RIGHT_ELBOW'],
  ['RIGHT_ELBOW', 'RIGHT_WRIST'],
  ['MID_SHOULDER', 'MID_HIP'],
  ['LEFT_HIP', 'RIGHT_HIP'],
];

function getMidpoint(a?: PosePoint, b?: PosePoint) {
  if (!a || !b) {
    return null;
  }
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

export default function SkeletonScreen() {
  const webViewRef = useRef<WebView>(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<{ base64: string; mimeType?: string } | null>(
    null
  );
  const [keypoints, setKeypoints] = useState<PoseKeypoints | null>(null);

  const sendPayloadToWebView = useCallback((payload: { base64: string; mimeType?: string }) => {
    webViewRef.current?.postMessage(JSON.stringify({ type: 'RUN_POSE', ...payload }));
  }, []);

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
      base64: true,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    if (!asset?.base64) {
      Alert.alert('骨格の検出に失敗しました');
      return;
    }

    setKeypoints(null);

    const payload = {
      base64: asset.base64,
      mimeType: asset.mimeType ?? 'image/jpeg',
    };

    if (webViewReady) {
      sendPayloadToWebView(payload);
    } else {
      setPendingPayload(payload);
    }
  }, [sendPayloadToWebView, webViewReady]);

  const onWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);

        if (data.type === 'READY') {
          setWebViewReady(true);
          if (pendingPayload) {
            sendPayloadToWebView(pendingPayload);
            setPendingPayload(null);
          }
          return;
        }

        if (data.type === 'POSE_RESULT') {
          setKeypoints(data.keypoints ?? null);
          return;
        }

        if (data.type === 'POSE_ERROR') {
          Alert.alert('骨格の検出に失敗しました');
          return;
        }
      } catch {
        Alert.alert('骨格の検出に失敗しました');
      }
    },
    [pendingPayload, sendPayloadToWebView]
  );

  const normalized = useMemo(() => {
    const leftShoulder = keypoints?.LEFT_SHOULDER;
    const rightShoulder = keypoints?.RIGHT_SHOULDER;

    if (!leftShoulder || !rightShoulder) {
      return null;
    }

    const midShoulder = getMidpoint(leftShoulder, rightShoulder);
    if (!midShoulder) {
      return null;
    }

    const shoulderWidth = Math.hypot(rightShoulder.x - leftShoulder.x, rightShoulder.y - leftShoulder.y);
    if (!shoulderWidth || shoulderWidth < 1) {
      return null;
    }

    const centerX = DRAW_WIDTH / 2;
    const centerY = DRAW_HEIGHT * 0.25;

    const mapPoint = (point?: PosePoint | null) => {
      if (!point) {
        return null;
      }
      const nx = (point.x - midShoulder.x) / shoulderWidth;
      const ny = (point.y - midShoulder.y) / shoulderWidth;
      return {
        x: centerX + nx * SCALE_MULTIPLIER,
        y: centerY + ny * SCALE_MULTIPLIER,
      };
    };

    const mapped: NormalizedPoints = {
      LEFT_SHOULDER: mapPoint(keypoints?.LEFT_SHOULDER),
      RIGHT_SHOULDER: mapPoint(keypoints?.RIGHT_SHOULDER),
      LEFT_ELBOW: mapPoint(keypoints?.LEFT_ELBOW),
      RIGHT_ELBOW: mapPoint(keypoints?.RIGHT_ELBOW),
      LEFT_WRIST: mapPoint(keypoints?.LEFT_WRIST),
      RIGHT_WRIST: mapPoint(keypoints?.RIGHT_WRIST),
      LEFT_HIP: mapPoint(keypoints?.LEFT_HIP),
      RIGHT_HIP: mapPoint(keypoints?.RIGHT_HIP),
    };

    const mappedMidShoulder = getMidpoint(mapped.LEFT_SHOULDER ?? undefined, mapped.RIGHT_SHOULDER ?? undefined);
    const mappedMidHip = getMidpoint(mapped.LEFT_HIP ?? undefined, mapped.RIGHT_HIP ?? undefined);

    return {
      points: mapped,
      midShoulder: mappedMidShoulder,
      midHip: mappedMidHip,
    };
  }, [keypoints]);

  return (
    <View style={styles.container}>
      <Pressable style={styles.button} onPress={pickImage}>
        <Text style={styles.buttonText}>写真を選ぶ</Text>
      </Pressable>

      <View style={styles.previewContainer}>
        {normalized ? (
          <Svg width={DRAW_WIDTH} height={DRAW_HEIGHT}>
            {SEGMENTS.map((segment, index) => {
              const [start, end] = segment;
              const startPoint =
                start === 'MID_SHOULDER'
                  ? normalized.midShoulder
                  : start === 'MID_HIP'
                    ? normalized.midHip
                    : normalized.points[start];
              const endPoint =
                end === 'MID_SHOULDER'
                  ? normalized.midShoulder
                  : end === 'MID_HIP'
                    ? normalized.midHip
                    : normalized.points[end];

              if (!startPoint || !endPoint) {
                return null;
              }

              return (
                <Line
                  key={index}
                  x1={startPoint.x}
                  y1={startPoint.y}
                  x2={endPoint.x}
                  y2={endPoint.y}
                  stroke="#2563EB"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              );
            })}
          </Svg>
        ) : (
          <Text style={styles.emptyText}>写真を選んでください</Text>
        )}
      </View>

      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: HTML }}
        onMessage={onWebViewMessage}
        javaScriptEnabled
        style={styles.hiddenWebView}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  previewContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#1F2937',
    fontSize: 16,
  },
  hiddenWebView: {
    width: 1,
    height: 1,
    opacity: 0,
    position: 'absolute',
  },
});
