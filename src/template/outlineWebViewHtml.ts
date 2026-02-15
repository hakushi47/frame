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
        const OUTLINE_LINE_WIDTH = 3;

        function distance(a, b) {
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          return Math.hypot(dx, dy);
        }

        function simplifyOutlinePoints(points, tolerance) {
          const effectiveTolerance = typeof tolerance === 'number' ? tolerance : 2;
          if (!points || points.length <= 3) {
            return points ? points.slice() : [];
          }

          const simplified = [points[0]];

          for (let i = 1; i < points.length; i += 1) {
            const next = points[i];
            const last = simplified[simplified.length - 1];

            if (distance(last, next) >= effectiveTolerance) {
              simplified.push(next);
            }
          }

          if (
            simplified.length > 2
            && distance(simplified[0], simplified[simplified.length - 1]) < effectiveTolerance
          ) {
            simplified.pop();
          }

          return simplified;
        }

        function chaikinClosed(points) {
          const n = points.length;
          if (n < 3) {
            return points.slice();
          }

          const nextPoints = [];

          for (let i = 0; i < n; i += 1) {
            const current = points[i];
            const next = points[(i + 1) % n];

            nextPoints.push({
              x: 0.75 * current.x + 0.25 * next.x,
              y: 0.75 * current.y + 0.25 * next.y,
            });
            nextPoints.push({
              x: 0.25 * current.x + 0.75 * next.x,
              y: 0.25 * current.y + 0.75 * next.y,
            });
          }

          return nextPoints;
        }

        function smoothOutlinePoints(points, iterations) {
          const effectiveIterations = typeof iterations === 'number' ? iterations : 3;
          if (effectiveIterations <= 0 || points.length < 3) {
            return points.slice();
          }

          let smoothed = points.slice();

          for (let i = 0; i < effectiveIterations; i += 1) {
            smoothed = chaikinClosed(smoothed);
          }

          return smoothed;
        }

        function processOutlinePoints(points, options) {
          const simplifyTolerance = options && typeof options.simplifyTolerance === 'number'
            ? options.simplifyTolerance
            : 2;
          const smoothingIterations = options && typeof options.smoothingIterations === 'number'
            ? options.smoothingIterations
            : 3;

          const simplified = simplifyOutlinePoints(points, simplifyTolerance);
          return smoothOutlinePoints(simplified, smoothingIterations);
        }

        function createStageError(stage, error) {
          const detail = error && error.message ? error.message : String(error);
          return new Error('[' + stage + '] ' + detail);
        }

        function isBoundaryPixel(mask, width, height, x, y) {
          if (x < 0 || y < 0 || x >= width || y >= height) {
            return false;
          }
          const index = y * width + x;
          if (!mask[index]) {
            return false;
          }

          for (let oy = -1; oy <= 1; oy += 1) {
            for (let ox = -1; ox <= 1; ox += 1) {
              if (!ox && !oy) {
                continue;
              }
              const nx = x + ox;
              const ny = y + oy;
              if (nx < 0 || ny < 0 || nx >= width || ny >= height || !mask[ny * width + nx]) {
                return true;
              }
            }
          }
          return false;
        }

        function traceOuterContour(mask, width, height) {
          const dirs = [
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
            { x: -1, y: 1 },
            { x: -1, y: 0 },
            { x: -1, y: -1 },
            { x: 0, y: -1 },
            { x: 1, y: -1 },
          ];

          let start = null;
          for (let y = 0; y < height && !start; y += 1) {
            for (let x = 0; x < width; x += 1) {
              if (isBoundaryPixel(mask, width, height, x, y)) {
                start = { x, y };
                break;
              }
            }
          }

          if (!start) {
            return [];
          }

          const points = [];
          let current = start;
          let previous = { x: start.x - 1, y: start.y };
          const maxSteps = width * height * 2;

          for (let step = 0; step < maxSteps; step += 1) {
            points.push({ x: current.x, y: current.y });

            let baseDir = 0;
            for (let d = 0; d < dirs.length; d += 1) {
              if (current.x + dirs[d].x === previous.x && current.y + dirs[d].y === previous.y) {
                baseDir = d;
                break;
              }
            }

            let found = null;
            for (let i = 1; i <= dirs.length; i += 1) {
              const dirIndex = (baseDir + i) % dirs.length;
              const candidate = { x: current.x + dirs[dirIndex].x, y: current.y + dirs[dirIndex].y };
              if (!isBoundaryPixel(mask, width, height, candidate.x, candidate.y)) {
                continue;
              }
              found = {
                next: candidate,
                backtrack: {
                  x: current.x + dirs[(dirIndex + dirs.length - 1) % dirs.length].x,
                  y: current.y + dirs[(dirIndex + dirs.length - 1) % dirs.length].y,
                },
              };
              break;
            }

            if (!found) {
              break;
            }

            previous = found.backtrack;
            current = found.next;

            if (current.x === start.x && current.y === start.y && points.length > 20) {
              break;
            }
          }

          return points;
        }

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

        function drawOutlinePng(points, width, height) {
          const outputCanvas = document.createElement('canvas');
          outputCanvas.width = width;
          outputCanvas.height = height;

          const outputCtx = outputCanvas.getContext('2d', { alpha: true, desynchronized: false });
          outputCtx.clearRect(0, 0, width, height);
          outputCtx.imageSmoothingEnabled = true;
          outputCtx.lineWidth = OUTLINE_LINE_WIDTH;
          outputCtx.strokeStyle = '#000000';
          outputCtx.lineJoin = 'round';
          outputCtx.lineCap = 'round';

          if (points.length > 1) {
            outputCtx.beginPath();
            outputCtx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i += 1) {
              outputCtx.lineTo(points[i].x, points[i].y);
            }
            outputCtx.closePath();
            outputCtx.stroke();
          }

          return outputCanvas.toDataURL('image/png');
        }

        async function runOutline(base64, mimeType, options) {
          try {
            if (!window.SelfieSegmentation) {
              throw new Error('Selfie Segmentationの読み込みに失敗しました');
            }

            const dataUrl = 'data:' + (mimeType || 'image/jpeg') + ';base64,' + base64;
            const sourceImage = await loadImage(dataUrl).catch((error) => {
              throw createStageError('image-load', error);
            });
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
            }).catch((error) => {
              throw createStageError('segmentation-send', error);
            });

            if (!results || !results.segmentationMask) {
              throw new Error('[segmentation-mask] 人物マスクを生成できませんでした');
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
            const rawContour = traceOuterContour(boundaryMask, resized.width, resized.height);
            const smoothContour = processOutlinePoints(rawContour, {
              simplifyTolerance: options && options.simplifyTolerance,
              smoothingIterations: options && options.smoothingIterations,
            });

            if (smoothContour.length < 2) {
              throw new Error('[contour] 輪郭点が不足しており線PNGを生成できませんでした');
            }

            const pngDataUrl = drawOutlinePng(smoothContour, resized.width, resized.height);

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
              runOutline(payload.base64, payload.mimeType, payload.options);
            }
          } catch (error) {
            send({
              type: 'OUTLINE_ERROR',
              message: '[message-parse] ' + (error && error.message ? error.message : String(error)),
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
