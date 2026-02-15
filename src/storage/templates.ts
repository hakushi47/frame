import * as FileSystem from 'expo-file-system/legacy';

import { Template } from '@/src/models/template';

const BASE_DIR = `${FileSystem.documentDirectory}frame/`;
const TEMPLATES_FILE = `${BASE_DIR}templates.json`;
export const TEMPLATE_IMAGES_DIR = `${BASE_DIR}templates/`;

export async function ensureTemplateStorageReady() {
  await ensureDir(BASE_DIR);
  await ensureDir(TEMPLATE_IMAGES_DIR);
  await ensureFile(TEMPLATES_FILE);
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

async function readTemplatesFile(): Promise<Template[]> {
  await ensureTemplateStorageReady();
  const content = await FileSystem.readAsStringAsync(TEMPLATES_FILE);
  if (!content.trim()) {
    return [];
  }

  try {
    const data = JSON.parse(content) as Array<
      Template & {
        imageUri?: string;
        createdAt?: number | string;
      }
    >;

    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((item) => {
        const createdAtValue = item.createdAt;
        const createdAt =
          typeof createdAtValue === 'number'
            ? createdAtValue
            : typeof createdAtValue === 'string'
              ? new Date(createdAtValue).getTime() || Date.now()
              : Date.now();

        const overlayPngUri = item.overlayPngUri ?? item.imageUri;
        if (!overlayPngUri || !item.id) {
          return null;
        }

        return {
          id: item.id,
          createdAt,
          overlayPngUri,
        } satisfies Template;
      })
      .filter((template): template is Template => Boolean(template));
  } catch {
    return [];
  }
}

async function writeTemplatesFile(templates: Template[]) {
  await ensureTemplateStorageReady();
  await FileSystem.writeAsStringAsync(TEMPLATES_FILE, JSON.stringify(templates, null, 2));
}

export async function listTemplates(): Promise<Template[]> {
  const templates = await readTemplatesFile();
  return templates.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getTemplate(id: string): Promise<Template | undefined> {
  const templates = await readTemplatesFile();
  return templates.find((template) => template.id === id);
}

export async function addTemplate(template: Template): Promise<void> {
  const templates = await readTemplatesFile();
  templates.push(template);
  await writeTemplatesFile(templates);
}

export async function deleteTemplate(id: string): Promise<void> {
  const templates = await readTemplatesFile();
  const target = templates.find((template) => template.id === id);

  if (target?.overlayPngUri) {
    const info = await FileSystem.getInfoAsync(target.overlayPngUri);
    if (info.exists) {
      await FileSystem.deleteAsync(target.overlayPngUri, { idempotent: true });
    }
  }

  await writeTemplatesFile(templates.filter((template) => template.id !== id));
}
