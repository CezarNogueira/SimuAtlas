// Salvamento em IndexedDB: multiplos saves (metadados separados dos dados comprimidos com gzip),
// autosave, exportacao e importacao de arquivos.
import type { GameState } from '../state/types';

export interface SaveMeta {
  id: string;
  name: string;
  mapId: string;
  mapName: string;
  eraId: string;
  year: number;
  dateText: string;
  nations: number;
  createdAt: number;
  updatedAt: number;
  size: number;
  auto: boolean;
  // Versao do formato do save (ausente nos saves antigos, de provincias por cidades).
  version?: number;
}

const DB_NAME = 'atlas-vivo';
const DB_VERSION = 1;
const FILE_MAGIC = 'atlas-vivo-save';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('data')) db.createObjectStore('data', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function compressJson(value: unknown): Promise<Blob> {
  const text = JSON.stringify(value);
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

export async function decompressJson<T>(blob: Blob): Promise<T> {
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(stream).text();
  return JSON.parse(text) as T;
}

function validateState(value: unknown): GameState {
  const s = value as GameState;
  if (!s || typeof s !== 'object' || !Array.isArray(s.countries) || !Array.isArray(s.provinces) || typeof s.mapId !== 'string') {
    throw new Error('Arquivo de save inválido.');
  }
  return s;
}

export class SaveManager {
  private db: Promise<IDBDatabase> | null = null;

  private database(): Promise<IDBDatabase> {
    if (!this.db) this.db = openDb();
    return this.db;
  }

  async list(): Promise<SaveMeta[]> {
    const db = await this.database();
    const tx = db.transaction('meta', 'readonly');
    const all = await request(tx.objectStore('meta').getAll() as IDBRequest<SaveMeta[]>);
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async save(meta: Omit<SaveMeta, 'size' | 'createdAt' | 'updatedAt'>, state: GameState): Promise<SaveMeta> {
    const db = await this.database();
    const blob = await compressJson(state);
    const existing = (await this.list()).find((m) => m.id === meta.id);
    const now = Date.now();
    const full: SaveMeta = { ...meta, size: blob.size, createdAt: existing?.createdAt ?? now, updatedAt: now };
    const tx = db.transaction(['meta', 'data'], 'readwrite');
    tx.objectStore('meta').put(full);
    tx.objectStore('data').put({ id: meta.id, blob });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return full;
  }

  async load(id: string): Promise<GameState> {
    const db = await this.database();
    const tx = db.transaction('data', 'readonly');
    const rec = await request(tx.objectStore('data').get(id) as IDBRequest<{ id: string; blob: Blob } | undefined>);
    if (!rec) throw new Error('Save não encontrado.');
    return validateState(await decompressJson(rec.blob));
  }

  async remove(id: string): Promise<void> {
    const db = await this.database();
    const tx = db.transaction(['meta', 'data'], 'readwrite');
    tx.objectStore('meta').delete(id);
    tx.objectStore('data').delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async exportFile(id: string): Promise<void> {
    const db = await this.database();
    const tx = db.transaction(['meta', 'data'], 'readonly');
    const meta = await request(tx.objectStore('meta').get(id) as IDBRequest<SaveMeta | undefined>);
    const rec = await request(tx.objectStore('data').get(id) as IDBRequest<{ id: string; blob: Blob } | undefined>);
    if (!meta || !rec) throw new Error('Save não encontrado.');
    const header = new Blob([`${FILE_MAGIC}\n${JSON.stringify(meta)}\n`]);
    const file = new Blob([header, rec.blob], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meta.name.replace(/[^\p{L}\p{N}_-]+/gu, '_')}.avsave`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async importFile(file: File): Promise<GameState> {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let newlines = 0;
    let offset = 0;
    for (let i = 0; i < Math.min(bytes.length, 64000); i++) {
      if (bytes[i] === 10) {
        newlines++;
        if (newlines === 2) {
          offset = i + 1;
          break;
        }
      }
    }
    const head = new TextDecoder().decode(bytes.slice(0, offset));
    if (!head.startsWith(FILE_MAGIC)) throw new Error('Este arquivo não é um save do Atlas Vivo.');
    return validateState(await decompressJson(new Blob([bytes.slice(offset)])));
  }
}
