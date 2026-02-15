export function createOutlineWebViewHtml(): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Template Outline Processor</title>
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js"></script>
  </head>
  <body>
    <script>
      (function () {
        const MAX_SIDE = 1024;
        const ALPHA_THRESHOLD = 0.5;

        function send(message) {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        }

        function loadImage(dataUrl) {
          return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
            image.src = dataUrl;
          });
        }

        function resizeDimensions(width, height) {
          const longest = Math.max(width, height);
          if (longest <= MAX_SIDE) {
            return { width, height };
          }

          const scale = MAX_SIDE / longest;
          return {
            width: Math.max(1, Math.round(width * scale)),
            height: Math.max(1, Math.round(height * scale)),
          };
        }

        function dilate(binaryMask, width, height, radius) {
          if (radius <= 0) {
            return binaryMask;
          }

          const out = new Uint8Array(binaryMask.length);
          for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
              const index = y * width + x;
              if (!binaryMask[index]) {
                continue;
              }

              for (let oy = -radius; oy <= radius; oy += 1) {
                const ny = y + oy;
                if (ny < 0 || ny >= height) continue;
                for (let ox = -radius; ox <= radius; ox += 1) {
                  const nx = x + ox;
                  if (nx < 0 || nx >= width) continue;
                  out[ny * width + nx] = 1;
                }
              }
            }
          }
          return out;
        }

        function erode(binaryMask, width, height, radius) {
          if (radius <= 0) {
            return binaryMask;
          }

          const out = new Uint8Array(binaryMask.length);
          for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
              let keep = 1;

              for (let oy = -radius; oy <= radius && keep; oy += 1) {
                const ny = y + oy;
                if (ny < 0 || ny >= height) {
                  keep = 0;
                  break;
                }

                for (let ox = -radius; ox <= radius; ox += 1) {
                  const nx = x + ox;
                  if (nx < 0 || nx >= width || !binaryMask[ny * width + nx]) {
                    keep = 0;
                    break;
                  }
                }
              }

              out[y * width + x] = keep;
            }
          }
          return out;
        }

        function buildBoundaryMask(personMask, width, height) {
          const dilated = dilate(personMask, width, height, 1);
          const eroded = erode(personMask, width, height, 1);
          const boundary = new Uint8Array(personMask.length);

          for (let i = 0; i < boundary.length; i += 1) {
            boundary[i] = dilated[i] && !eroded[i] ? 1 : 0;
          }

          return dilate(boundary, width, height, 1);
        }

        async function runOutline(base64, mimeType) {
          try {
            if (!window.SelfieSegmentation) {
              throw new Error('Selfie Segmentationの読み込みに失敗しました');
            }

            const dataUrl = 'data:' + (mimeType || 'image/jpeg') + ';base64,' + base64;
            const sourceImage = await loadImage(dataUrl);
            const resized = resizeDimensions(sourceImage.naturalWidth, sourceImage.naturalHeight);

            const inputCanvas = document.createElement('canvas');
            inputCanvas.width = resized.width;
            inputCanvas.height = resized.height;
            const inputCtx = inputCanvas.getContext('2d', { willReadFrequently: true });
            inputCtx.drawImage(sourceImage, 0, 0, resized.width, resized.height);

            const selfieSegmentation = new SelfieSegmentation({
              locateFile: (file) => 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/' + file,
            });
            selfieSegmentation.setOptions({ modelSelection: 1 });

            const results = await new Promise((resolve) => {
              selfieSegmentation.onResults((value) => resolve(value));
              selfieSegmentation.send({ image: inputCanvas });
            });

            if (!results || !results.segmentationMask) {
              throw new Error('人物マスクを生成できませんでした');
            }

            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = resized.width;
            maskCanvas.height = resized.height;
            const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
            maskCtx.drawImage(results.segmentationMask, 0, 0, resized.width, resized.height);

            const maskImageData = maskCtx.getImageData(0, 0, resized.width, resized.height);
            const personMask = new Uint8Array(resized.width * resized.height);

            for (let i = 0; i < personMask.length; i += 1) {
              const alpha = maskImageData.data[i * 4 + 3] / 255;
              personMask[i] = alpha >= ALPHA_THRESHOLD ? 1 : 0;
            }

            const boundaryMask = buildBoundaryMask(personMask, resized.width, resized.height);

            const outputCanvas = document.createElement('canvas');
            outputCanvas.width = resized.width;
            outputCanvas.height = resized.height;
            const outputCtx = outputCanvas.getContext('2d');
            const outputImageData = outputCtx.createImageData(resized.width, resized.height);

            for (let i = 0; i < boundaryMask.length; i += 1) {
              if (!boundaryMask[i]) {
                continue;
              }

              const base = i * 4;
              outputImageData.data[base] = 0;
              outputImageData.data[base + 1] = 0;
              outputImageData.data[base + 2] = 0;
              outputImageData.data[base + 3] = 255;
            }

            outputCtx.putImageData(outputImageData, 0, 0);
            const pngDataUrl = outputCanvas.toDataURL('image/png');

            send({ type: 'OUTLINE_RESULT', dataUrl: pngDataUrl });
          } catch (error) {
            send({
              type: 'OUTLINE_ERROR',
              message: error && error.message ? error.message : String(error),
            });
          }
        }

        function onMessage(event) {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'RUN_OUTLINE' && payload.base64) {
              runOutline(payload.base64, payload.mimeType);
            }
          } catch (error) {
            send({
              type: 'OUTLINE_ERROR',
              message: error && error.message ? error.message : String(error),
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
