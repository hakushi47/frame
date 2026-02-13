export function createPoseWebViewHtml(): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pose Processor</title>
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js"></script>
  </head>
  <body>
    <script>
      (function () {
        const POSE_KEYS = {
          LEFT_SHOULDER: 11,
          RIGHT_SHOULDER: 12,
          LEFT_ELBOW: 13,
          RIGHT_ELBOW: 14,
          LEFT_WRIST: 15,
          RIGHT_WRIST: 16,
          LEFT_HIP: 23,
          RIGHT_HIP: 24,
        };

        function send(message) {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        }

        async function runPose(base64, mimeType) {
          try {
            if (!window.Pose) {
              throw new Error('MediaPipe Pose failed to load');
            }

            const dataUrl = 'data:' + (mimeType || 'image/jpeg') + ';base64,' + base64;
            const img = new Image();
            img.src = dataUrl;

            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
            });

            const pose = new Pose({
              locateFile: (file) => 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/' + file,
            });

            pose.setOptions({
              staticImageMode: true,
              modelComplexity: 1,
              smoothLandmarks: false,
              enableSegmentation: false,
              minDetectionConfidence: 0.5,
              minTrackingConfidence: 0.5,
            });

            const result = await new Promise((resolve) => {
              pose.onResults((results) => resolve(results));
              pose.send({ image: img });
            });

            const landmarks = result && result.poseLandmarks;
            if (!landmarks) {
              throw new Error('No pose landmarks');
            }

            const keypoints = {};
            Object.entries(POSE_KEYS).forEach(([name, index]) => {
              const lm = landmarks[index];
              if (!lm) {
                return;
              }
              keypoints[name] = {
                x: lm.x * img.naturalWidth,
                y: lm.y * img.naturalHeight,
                visibility: typeof lm.visibility === 'number' ? lm.visibility : null,
                confidence: typeof lm.presence === 'number' ? lm.presence : null,
              };
            });

            send({
              type: 'POSE_RESULT',
              keypoints,
              imageWidth: img.naturalWidth,
              imageHeight: img.naturalHeight,
            });
          } catch (error) {
            send({
              type: 'POSE_ERROR',
              message: error instanceof Error ? error.message : String(error),
            });
          }
        }

        function onMessage(event) {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'RUN_POSE' && payload.base64) {
              runPose(payload.base64, payload.mimeType);
            }
          } catch (error) {
            send({
              type: 'POSE_ERROR',
              message: error instanceof Error ? error.message : String(error),
            });
          }
        }

        document.addEventListener('message', onMessage);
        window.addEventListener('message', onMessage);

        send({ type: 'READY' });
      })();
    </script>
  </body>
</html>`;
}
