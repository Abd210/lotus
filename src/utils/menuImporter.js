import { db, storage } from '../firebase';
import { collection, addDoc, getDocs, writeBatch, doc, setDoc, getDoc } from 'firebase/firestore';

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid ${label}`);
  }
}

function assertLangObject(value, label) {
  if (!value || typeof value !== 'object') {
    throw new Error(`Invalid ${label}`);
  }
  assertNonEmptyString(value.en, `${label}.en`);
  assertNonEmptyString(value.ro, `${label}.ro`);
  assertNonEmptyString(value.ar, `${label}.ar`);
}

function assertLangObjectAllowEmpty(value, label) {
  if (!value || typeof value !== 'object') {
    throw new Error(`Invalid ${label}`);
  }
  for (const k of ['en', 'ro', 'ar']) {
    if (typeof value[k] !== 'string') throw new Error(`Invalid ${label}.${k}`);
  }
}

function splitLines(text) {
  return (text || '').replace(/\r\n/g, '\n').split('\n');
}

function isDashLine(line) {
  return /^-{3,}$/.test((line || '').trim());
}

function isTitleLine(line) {
  const t = (line || '').trim();
  if (!t) return false;
  return (
    t === 'LOTUS - MENU' ||
    t === 'LOTUS - MENIU' ||
    t.includes('لوتس')
  );
}

function isDescriptionStart(line) {
  const t = (line || '').trim();
  return (
    t.startsWith('Ingredients:') ||
    t.startsWith('Ingrediente:') ||
    t.startsWith('المكونات:') ||
    t.startsWith('Nutritional') ||
    t.startsWith('Valori') ||
    t.startsWith('القيم')
  );
}

function extractPrice(line) {
  const t = (line || '').trim();
  // Prefer explicit currency markers.
  const leiMatch = t.match(/(\d+(?:[\.,]\d+)?)\s*LEI\b/i);
  if (leiMatch) return parseFloat(leiMatch[1].replace(',', '.'));
  // Note: JS \b word boundary does not treat Arabic letters as word chars.
  // Match Arabic currency at end-of-line (optionally surrounded by spaces).
  const arMatch = t.match(/(\d+(?:[\.,]\d+)?)\s*لي\s*[\u060C\.,]?\s*$/);
  if (arMatch) return parseFloat(arMatch[1].replace(',', '.'));
  return null;
}

function isPortionLabel(line) {
  const t = (line || '').trim();
  // Examples: "1p 650 g", "2p 1300 g", "1ب 650 غ", "2ب 1300 غ"
  return /^\d+\s*(?:p|ب)\s+\d+\s*(?:g|غ|kg|كغ)\b/i.test(t);
}

function splitOnDashSeparators(text) {
  // Supports em dash, en dash, and hyphen-minus.
  return String(text || '').split(/\s*[—–-]\s*/g).map(s => s.trim()).filter(Boolean);
}

function extractNameFromProductLine(line) {
  const parts = splitOnDashSeparators(line);
  if (parts.length === 0) return '';
  return parts[0] || '';
}

function parseLanguageStructure(text) {
  const lines = splitLines(text);
  const categories = [];
  let current = null;
  let pendingPortion = '';

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] || '').trim();
    if (!line || line.startsWith('===') || isTitleLine(line)) continue;

    // Category header: line followed by dashes
    if (i + 1 < lines.length && isDashLine(lines[i + 1])) {
      current = { name: line, products: [] };
      categories.push(current);
      i += 1;
      pendingPortion = '';
      continue;
    }

    if (isPortionLabel(line)) {
      pendingPortion = line;
      continue;
    }

    const price = extractPrice(line);
    // Treat as product if we can extract a price, regardless of dash character.
    if (price !== null) {
      let name = extractNameFromProductLine(line);
      // Handle GRILL MIX style where price is on its own line ("— 98 LEI" / "— 98 لي").
      if (!name && pendingPortion) {
        name = pendingPortion;
      }
      pendingPortion = '';

      const desc = [];
      let collecting = false;
      let j = i + 1;
      while (j < lines.length) {
        const t = (lines[j] || '').trim();
        if (!t) break;
        if (isDashLine(t)) break;
        if (j + 1 < lines.length && isDashLine(lines[j + 1])) break;
        const nextPrice = extractPrice(t);
        if (t.includes('—') && nextPrice !== null) break;

        if (isDescriptionStart(t)) {
          collecting = true;
          desc.push(t);
        } else if (collecting) {
          desc.push(t);
        }
        j++;
      }

      if (current) {
        current.products.push({ name, price, description: desc.join('\n').trim() });
      }
      i = j - 1;
    }
  }

  return categories;
}

function hashString(input) {
  // djb2 hash; stable, fast, works for unicode strings.
  let hash = 5381;
  const str = String(input || '');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  // Convert to unsigned hex
  return (hash >>> 0).toString(16);
}

// Parse menu structure from text files.
// This is STRICT: it merges by category order + product order and aborts when
// counts/prices don't line up to avoid wrong translations being imported.
export function parseMenuData(englishText, romanianText, arabicText) {
  const enCats = parseLanguageStructure(englishText);
  const roCats = parseLanguageStructure(romanianText);
  const arCats = parseLanguageStructure(arabicText);

  const issues = [];
  const categories = [];
  const products = [];

  const catCount = enCats.length;
  if (roCats.length !== catCount) {
    issues.push(`Category count mismatch: EN=${enCats.length}, RO=${roCats.length}`);
  }
  if (arCats.length !== catCount) {
    issues.push(`Category count mismatch: EN=${enCats.length}, AR=${arCats.length}`);
  }

  const minCatCount = Math.min(enCats.length, roCats.length, arCats.length);
  for (let ci = 0; ci < minCatCount; ci++) {
    const enC = enCats[ci];
    const roC = roCats[ci];
    const arC = arCats[ci];

    const enCount = enC.products.length;
    if (roC.products.length !== enCount) {
      issues.push(`Product count mismatch in category #${ci + 1} (${enC.name}): EN=${enCount}, RO=${roC.products.length}`);
      continue;
    }
    if (arC.products.length !== enCount) {
      issues.push(`Product count mismatch in category #${ci + 1} (${enC.name}): EN=${enCount}, AR=${arC.products.length}`);
      continue;
    }

    const mergedCategory = {
      en: enC.name,
      ro: roC.name || enC.name,
      ar: arC.name || enC.name
    };

    for (let pi = 0; pi < enCount; pi++) {
      const enP = enC.products[pi];
      const roP = roC.products[pi];
      const arP = arC.products[pi];

      if (typeof enP.price === 'number') {
        if (typeof roP.price === 'number' && Math.abs(roP.price - enP.price) > 0.001) {
          issues.push(`Price mismatch in ${enC.name} item #${pi + 1} (${enP.name}): EN=${enP.price}, RO=${roP.price}`);
          continue;
        }
        if (typeof arP.price === 'number' && Math.abs(arP.price - enP.price) > 0.001) {
          issues.push(`Price mismatch in ${enC.name} item #${pi + 1} (${enP.name}): EN=${enP.price}, AR=${arP.price}`);
          continue;
        }
      }

      products.push({
        name: { en: enP.name, ro: roP.name || enP.name, ar: arP.name || enP.name },
        name_ro: roP.name || enP.name,
        description: {
          en: (enP.description || '').trim() || 'No description available',
          ro: (roP.description || '').trim() || 'Fără descriere',
          ar: (arP.description || '').trim() || 'لا يوجد وصف'
        },
        price: enP.price,
        category: mergedCategory,
        imageUrl: ''
      });
    }

    categories.push({
      name: mergedCategory,
      name_ro: mergedCategory.ro,
      parentId: null,
      imageUrl: ''
    });
  }

  return { categories, products, issues };
}

// Import data to Firestore
export async function importMenuToFirestore(categories, products) {
  const results = {
    categoriesAdded: 0,
    productsAdded: 0,
    errors: []
  };

  try {
    // Upsert categories with stable IDs (safe to re-run import)
    const categoryMap = new Map();

    for (const category of categories) {
      try {
        const categoryKey = category.name?.en || category.name?.ro || JSON.stringify(category.name || {});
        const categoryId = `cat_${hashString(categoryKey)}`;
        await setDoc(doc(db, 'categories', categoryId), {
          ...category,
          createdAt: Date.now()
        }, { merge: true });
        categoryMap.set(categoryKey, categoryId);
        results.categoriesAdded++;
      } catch (error) {
        console.error('Error upserting category:', category.name, error);
        results.errors.push(`Category: ${category.name?.en || category.name?.ro || 'unknown'}`);
      }
    }

    // Upsert products with stable IDs (prevents duplicates and fixes Arabic mismatches on re-run)
    for (const product of products) {
      try {
        const categoryKey = product.category?.en || product.category?.ro || JSON.stringify(product.category || {});
        const categoryId = categoryMap.get(categoryKey) || null;
        const productKey = `${categoryKey}|${product.name?.en || ''}|${product.price}`;
        const productId = `prod_${hashString(productKey)}`;

        await setDoc(doc(db, 'products', productId), {
          name: product.name,
          name_ro: product.name_ro,
          description: product.description,
          price: product.price,
          categoryId,
          imageUrl: product.imageUrl,
          createdAt: Date.now()
        }, { merge: true });

        results.productsAdded++;
      } catch (error) {
        console.error('Error upserting product:', product.name, error);
        results.errors.push(`Product: ${product.name?.en || product.name?.ro || 'unknown'}`);
      }
    }

  } catch (error) {
    console.error('Import error:', error);
    results.errors.push(`Global error: ${error.message}`);
  }

  return results;
}

// Import a manually curated JSON dataset (no parsing).
// Expected format: { categories: [{ key, name{en,ro,ar}, parentKey?, imageUrl? }], products: [{ categoryKey, name{en,ro,ar}, description{en,ro,ar}, price, imageUrl? }] }
export async function importManualMenuJsonToFirestore(dataset) {
  if (!dataset || typeof dataset !== 'object') throw new Error('Invalid dataset');
  if (!Array.isArray(dataset.categories)) throw new Error('Dataset missing categories[]');
  if (!Array.isArray(dataset.products)) throw new Error('Dataset missing products[]');

  const categoriesByKey = new Map();
  for (const c of dataset.categories) {
    assertNonEmptyString(c?.key, 'category.key');
    assertLangObject(c?.name, 'category.name');
    if (categoriesByKey.has(c.key)) throw new Error(`Duplicate category.key: ${c.key}`);
    categoriesByKey.set(c.key, c);
  }

  const categoryIdByKey = new Map();
  for (const [key] of categoriesByKey) {
    categoryIdByKey.set(key, `cat_${hashString(`manual_category:${key}`)}`);
  }

  // Upsert categories; ensure parents exist first.
  const orderedCategoryKeys = Array.from(categoriesByKey.keys()).sort((a, b) => {
    const pa = categoriesByKey.get(a)?.parentKey ? 1 : 0;
    const pb = categoriesByKey.get(b)?.parentKey ? 1 : 0;
    return pa - pb;
  });

  let categoriesAdded = 0;
  let productsAdded = 0;
  const errors = [];

  for (const key of orderedCategoryKeys) {
    const c = categoriesByKey.get(key);
    try {
      const id = categoryIdByKey.get(key);
      const parentKey = c.parentKey || null;
      const parentId = parentKey ? categoryIdByKey.get(parentKey) : null;
      if (parentKey && !parentId) throw new Error(`Unknown category.parentKey: ${parentKey}`);

      const ref = doc(db, 'categories', id);
      const existing = await getDoc(ref);
      await setDoc(ref, {
        key,
        name: c.name,
        name_ro: c.name.ro,
        parentId,
        imageUrl: c.imageUrl || '',
        createdAt: existing.exists() ? (existing.data()?.createdAt ?? Date.now()) : Date.now()
      }, { merge: true });
      categoriesAdded++;
    } catch (e) {
      console.error('Error upserting manual category:', key, e);
      errors.push(`Category: ${key}`);
    }
  }

  for (const p of dataset.products) {
    try {
      assertNonEmptyString(p?.categoryKey, 'product.categoryKey');
      const cat = categoriesByKey.get(p.categoryKey);
      if (!cat) throw new Error(`Unknown product.categoryKey: ${p.categoryKey}`);
      assertLangObject(p?.name, 'product.name');
      assertLangObjectAllowEmpty(p?.description, 'product.description');
      if (typeof p.price !== 'number' || Number.isNaN(p.price)) throw new Error('Invalid product.price');

      const categoryId = categoryIdByKey.get(p.categoryKey);
      const productId = `prod_${hashString(`manual_product:${p.categoryKey}|${p.name.en}|${p.price}`)}`;
      const ref = doc(db, 'products', productId);
      const existing = await getDoc(ref);
      await setDoc(ref, {
        name: p.name,
        name_ro: p.name.ro,
        description: p.description,
        price: p.price,
        categoryId,
        imageUrl: p.imageUrl || '',
        createdAt: existing.exists() ? (existing.data()?.createdAt ?? Date.now()) : Date.now()
      }, { merge: true });
      productsAdded++;
    } catch (e) {
      console.error('Error upserting manual product:', p?.name?.en || p?.name?.ro || p?.name?.ar || p, e);
      errors.push(`Product: ${p?.name?.en || p?.name?.ro || 'unknown'}`);
    }
  }

  return { categoriesAdded, productsAdded, errors };
}

// Clear all menu data (use with caution!)
export async function clearAllMenuData() {
  async function clearCollection(name) {
    const snap = await getDocs(collection(db, name));
    let batch = writeBatch(db);
    let opCount = 0;
    for (const d of snap.docs) {
      batch.delete(d.ref);
      opCount++;
      if (opCount >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    }
    if (opCount > 0) await batch.commit();
  }

  // Firestore batches are limited to 500 ops; keep a margin.
  await clearCollection('products');
  await clearCollection('categories');
}
