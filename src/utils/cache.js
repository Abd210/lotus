// Simple in-memory + sessionStorage cache with TTL and SWR behavior
const memory = {
  categories: null, // { data: [...], ts }
  categoryBundles: new Map(), // categoryId -> { category, subcategories, products, ts }
  products: new Map(), // productId -> { data, ts }
};

const TTL_MS = 5 * 60 * 1000; // 5 minutes

function now() { return Date.now(); }
function isFresh(ts) { return ts && now() - ts < TTL_MS; }

// Helpers for sessionStorage
function ssGet(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function ssSet(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// Categories list
export function getCategoriesCache() {
  if (memory.categories && isFresh(memory.categories.ts)) return memory.categories.data;
  const stored = ssGet('cache:categories');
  if (stored && isFresh(stored.ts)) {
    memory.categories = stored;
    return stored.data;
  }
  return null;
}
export function setCategoriesCache(data) {
  const entry = { data, ts: now() };
  memory.categories = entry;
  ssSet('cache:categories', entry);
}

// Category bundle (category + subcategories + products)
export function getCategoryBundle(categoryId) {
  const m = memory.categoryBundles.get(categoryId);
  if (m && isFresh(m.ts)) return m;
  const stored = ssGet(`cache:category:${categoryId}`);
  if (stored && isFresh(stored.ts)) {
    memory.categoryBundles.set(categoryId, stored);
    return stored;
  }
  return null;
}
export function setCategoryBundle(categoryId, bundle) {
  const entry = { ...bundle, ts: now() };
  memory.categoryBundles.set(categoryId, entry);
  ssSet(`cache:category:${categoryId}`, entry);
}

// Single product
export function getProductCache(productId) {
  const m = memory.products.get(productId);
  if (m && isFresh(m.ts)) return m.data;
  const stored = ssGet(`cache:product:${productId}`);
  if (stored && isFresh(stored.ts)) {
    memory.products.set(productId, stored);
    return stored.data;
  }
  return null;
}
export function setProductCache(productId, data) {
  const entry = { data, ts: now() };
  memory.products.set(productId, entry);
  ssSet(`cache:product:${productId}`, entry);
}
