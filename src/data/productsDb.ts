import * as FileSystem from 'expo-file-system';
import type { Category } from '../types';

const FILE_URI = FileSystem.documentDirectory + 'products.json';

export type Product = {
  id: string;
  title: string;
  price: number;
  features: string[];
  category: Category;
  createdAt: string; // ISO
};

export type ProductInput = Omit<Product, 'id' | 'createdAt'> & { id?: string };

async function ensureFile() {
  const info = await FileSystem.getInfoAsync(FILE_URI);
  if (!info.exists) {
    await FileSystem.writeAsStringAsync(FILE_URI, '[]', { encoding: FileSystem.EncodingType.UTF8 });
  }
}

export async function readProducts(): Promise<Product[]> {
  await ensureFile();
  const raw = await FileSystem.readAsStringAsync(FILE_URI, { encoding: FileSystem.EncodingType.UTF8 });
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr as Product[] : [];
  } catch {
    return [];
  }
}

export async function writeProducts(items: Product[]) {
  await FileSystem.writeAsStringAsync(FILE_URI, JSON.stringify(items, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function addProduct(input: ProductInput): Promise<Product> {
  await ensureFile();
  const items = await readProducts();

  // id üretimi (basit ve stabil)
  const id = input.id ?? String(Date.now());
  const createdAt = new Date().toISOString();

  const newItem: Product = {
    id,
    title: input.title.trim(),
    price: Number(input.price),
    features: input.features ?? [],
    category: input.category,
    createdAt,
  };

  await writeProducts([newItem, ...items]);
  return newItem;
}

export async function updateProduct(id: string, patch: Partial<Product>) {
  const items = await readProducts();
  const idx = items.findIndex(x => x.id === id);
  if (idx === -1) return false;
  items[idx] = { ...items[idx], ...patch };
  await writeProducts(items);
  return true;
}

export async function deleteProduct(id: string) {
  const items = await readProducts();
  const next = items.filter(x => x.id !== id);
  await writeProducts(next);
  return items.length !== next.length;
}

export const productsFilePath = FILE_URI; // debug için gerekirse gösterirsin
