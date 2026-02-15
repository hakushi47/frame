export type PendingTemplateImage = {
  id: string;
  base64: string;
  mimeType: string;
  previewUri: string;
  createdAt: number;
};

const EXPIRE_MS = 10 * 60 * 1000;
const store = new Map<string, PendingTemplateImage>();

function cleanupExpired(now: number) {
  for (const [key, value] of store.entries()) {
    if (now - value.createdAt > EXPIRE_MS) {
      store.delete(key);
    }
  }
}

export function createPendingTemplateImage(payload: Omit<PendingTemplateImage, 'id' | 'createdAt'>): string {
  const now = Date.now();
  cleanupExpired(now);

  const id = `${now}-${Math.random().toString(36).slice(2, 10)}`;
  store.set(id, {
    id,
    ...payload,
    createdAt: now,
  });

  return id;
}

export function getPendingTemplateImage(id: string): PendingTemplateImage | null {
  const now = Date.now();
  cleanupExpired(now);
  const value = store.get(id);
  return value ?? null;
}


export function clearPendingTemplateImage(id: string) {
  store.delete(id);
}
