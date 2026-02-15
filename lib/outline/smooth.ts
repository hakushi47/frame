export type OutlinePoint = {
  x: number;
  y: number;
};

export function distance(a: OutlinePoint, b: OutlinePoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function simplifyOutlinePoints(points: OutlinePoint[], tolerance = 2): OutlinePoint[] {
  if (points.length <= 3) {
    return points.slice();
  }

  const simplified: OutlinePoint[] = [points[0]];

  for (let i = 1; i < points.length; i += 1) {
    const next = points[i];
    const last = simplified[simplified.length - 1];

    if (distance(last, next) >= tolerance) {
      simplified.push(next);
    }
  }

  if (simplified.length > 2 && distance(simplified[0], simplified[simplified.length - 1]) < tolerance) {
    simplified.pop();
  }

  return simplified;
}

export function chaikinClosed(points: OutlinePoint[]): OutlinePoint[] {
  const n = points.length;
  if (n < 3) {
    return points.slice();
  }

  const nextPoints: OutlinePoint[] = [];

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

export function smoothOutlinePoints(points: OutlinePoint[], iterations = 3): OutlinePoint[] {
  if (iterations <= 0 || points.length < 3) {
    return points.slice();
  }

  let smoothed = points.slice();

  for (let i = 0; i < iterations; i += 1) {
    smoothed = chaikinClosed(smoothed);
  }

  return smoothed;
}

export function processOutlinePoints(
  points: OutlinePoint[],
  options?: {
    simplifyTolerance?: number;
    smoothingIterations?: number;
  }
): OutlinePoint[] {
  const simplifyTolerance = options?.simplifyTolerance ?? 2;
  const smoothingIterations = options?.smoothingIterations ?? 3;

  const simplified = simplifyOutlinePoints(points, simplifyTolerance);
  return smoothOutlinePoints(simplified, smoothingIterations);
}
