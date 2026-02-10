import * as FileSystem from 'expo-file-system/legacy';

import { Shot } from '@/src/models/shot';
import { Template } from '@/src/models/template';

const BASE_DIR = `${FileSystem.documentDirectory}frame/`;
const TEMPLATES_FILE = `${BASE_DIR}templates.json`;
const SHOTS_FILE = `${BASE_DIR}shots.json`;
export const IMAGES_DIR = `${BASE_DIR}images/`;
export const SHOTS_DIR = `${BASE_DIR}shots/`;

export async function ensureStorageReady() {
  await ensureDir(BASE_DIR);
  await ensureDir(IMAGES_DIR);
  await ensureDir(SHOTS_DIR);
  await ensureFile(TEMPLATES_FILE);
  await ensureFile(SHOTS_FILE);
}

async function ensureDir(path: string) {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
}

async function ensureFile(path: string) {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.writeAsStringAsync(path, '[]');
  }
}

async function readJsonFile<T>(path: string): Promise<T[]> {
  await ensureStorageReady();
  const content = await FileSystem.readAsStringAsync(path);
  if (!content.trim()) {
    return [];
  }

  try {
    const data = JSON.parse(content) as T[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeJsonFile<T>(path: string, data: T[]) {
  await ensureStorageReady();
  await FileSystem.writeAsStringAsync(path, JSON.stringify(data, null, 2));
}

export async function listTemplates(): Promise<Template[]> {
  const templates = await readJsonFile<Template>(TEMPLATES_FILE);
  return templates.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getTemplate(id: string): Promise<Template | undefined> {
  const templates = await readJsonFile<Template>(TEMPLATES_FILE);
  return templates.find((template) => template.id === id);
}

export async function addTemplate(template: Template): Promise<void> {
  const templates = await readJsonFile<Template>(TEMPLATES_FILE);
  templates.push(template);
  await writeJsonFile(TEMPLATES_FILE, templates);
}

export async function deleteTemplate(id: string): Promise<void> {
  const templates = await readJsonFile<Template>(TEMPLATES_FILE);
  const target = templates.find((template) => template.id === id);

  if (target?.imageUri) {
    const imageInfo = await FileSystem.getInfoAsync(target.imageUri);
    if (imageInfo.exists) {
      await FileSystem.deleteAsync(target.imageUri, { idempotent: true });
    }
  }

  await writeJsonFile(
    TEMPLATES_FILE,
    templates.filter((template) => template.id !== id)
  );
}

export async function listShots(templateId: string): Promise<Shot[]> {
  const shots = await readJsonFile<Shot>(SHOTS_FILE);
  return shots
    .filter((shot) => shot.templateId === templateId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function addShot(shot: Shot): Promise<void> {
  const shots = await readJsonFile<Shot>(SHOTS_FILE);
  shots.push(shot);
  await writeJsonFile(SHOTS_FILE, shots);
}

export async function deleteShot(shotId: string): Promise<void> {
  const shots = await readJsonFile<Shot>(SHOTS_FILE);
  const target = shots.find((shot) => shot.id === shotId);

  if (target?.imagePath) {
    const imageInfo = await FileSystem.getInfoAsync(target.imagePath);
    if (imageInfo.exists) {
      await FileSystem.deleteAsync(target.imagePath, { idempotent: true });
    }
  }

  await writeJsonFile(
    SHOTS_FILE,
    shots.filter((shot) => shot.id !== shotId)
  );
}
