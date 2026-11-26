// Lo personal vive solo en el teléfono (localStorage). Nunca se manda en ninguna petición.
import { STORE_PREFIX } from './config.js';

const KEYS = ['lang', 'keywords', 'lists', 'saved', 'read'];
const DEFAULTS = { lang: 'es', keywords: [], lists: [], saved: [], read: [] };
const MAX_READ = 3000;

function safeGet(k) {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + k);
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}
function safeSet(k, v) {
  try {
    localStorage.setItem(STORE_PREFIX + k, JSON.stringify(v));
  } catch {
    /* almacenamiento lleno o bloqueado: la app sigue funcionando en memoria */
  }
}

export const state = {};
for (const k of KEYS) state[k] = safeGet(k) ?? structuredClone(DEFAULTS[k]);
let readSet = new Set(state.read);
let savedMap = new Map(state.saved.map((s) => [s.id, s]));

export function persist(k) {
  if (k === 'read') state.read = [...readSet].slice(-MAX_READ);
  if (k === 'saved') state.saved = [...savedMap.values()];
  safeSet(k, state[k]);
}

export const isRead = (id) => readSet.has(id);
export function setRead(id, v = true) {
  if (v) readSet.add(id);
  else readSet.delete(id);
  persist('read');
}
export function clearRead() {
  readSet = new Set();
  persist('read');
}

export const isSaved = (id) => savedMap.has(id);
export function toggleSaved(item) {
  if (savedMap.has(item.id)) savedMap.delete(item.id);
  else {
    const { id, title, summary, url, source, market, tags, lang, time } = item;
    savedMap = new Map([[id, { id, title, summary, url, source, market, tags, lang, time, savedAt: new Date().toISOString() }], ...savedMap]);
  }
  persist('saved');
  return savedMap.has(item.id);
}
export const savedList = () => [...savedMap.values()];

export function setKeywords(list) {
  state.keywords = [...new Set(list.map((s) => s.trim()).filter(Boolean))];
  persist('keywords');
}
export function setLists(list) {
  state.lists = list;
  persist('lists');
}
export function setLangPref(l) {
  state.lang = l;
  persist('lang');
}

// Respaldo: exactamente lo personal, nada más.
export function exportData() {
  return { app: 'p1', version: 1, exportedAt: new Date().toISOString(), data: { lang: state.lang, keywords: state.keywords, lists: state.lists, saved: savedList(), read: [...readSet] } };
}

export function validBackup(obj) {
  const d = obj?.data;
  return (
    obj?.app === 'p1' &&
    d &&
    typeof d.lang === 'string' &&
    Array.isArray(d.keywords) && d.keywords.every((k) => typeof k === 'string') &&
    Array.isArray(d.lists) && d.lists.every((l) => l && typeof l.name === 'string' && typeof l.url === 'string') &&
    Array.isArray(d.saved) && d.saved.every((s) => s && typeof s.id === 'string' && typeof s.url === 'string') &&
    Array.isArray(d.read) && d.read.every((r) => typeof r === 'string')
  );
}

export function importData(obj) {
  if (!validBackup(obj)) return false;
  const d = obj.data;
  state.lang = d.lang;
  state.keywords = d.keywords;
  state.lists = d.lists;
  savedMap = new Map(d.saved.map((s) => [s.id, s]));
  readSet = new Set(d.read);
  for (const k of KEYS) persist(k);
  return true;
}

// Caché de datos públicos (no personales) para abrir sin internet.
export function cacheGet(k) {
  return safeGet('cache.' + k);
}
export function cacheSet(k, v) {
  safeSet('cache.' + k, v);
}
