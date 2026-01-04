import React from 'react';
import { db, storage } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { signOutUser, useAuth } from '../auth';
import { useToast } from '../components/Toast';
import { parseMenuData, importMenuToFirestore, clearAllMenuData, importManualMenuJsonToFirestore } from '../utils/menuImporter';
import manualMenuSeed from '../data/manualMenu_soups_breakfast_salads.json';
import manualMenuAppetizers from '../data/manualMenu_appetizers.json';
import manualMenuCatsMore from '../data/manualMenu_categories_grill_international_sides_pasta.json';
import manualMenuBurgers from '../data/manualMenu_burgers.json';
import manualMenuDessertsDrinks from '../data/manualMenu_desserts_coffee_freakshakes_lemonades.json';
import manualMenuSoftDrinksCocktails from '../data/manualMenu_softdrinks_cocktails_mocktails.json';
import manualMenuSauces from '../data/manualMenu_sauces.json';

function sanitizeFilename(name) {
	return (name || 'image')
		.toString()
		.replace(/[^a-zA-Z0-9._-]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 120) || 'image';
}

function fileExtForMime(mime) {
	switch (mime) {
		case 'image/webp': return 'webp';
		case 'image/jpeg': return 'jpg';
		case 'image/png': return 'png';
		default: return 'bin';
	}
}

async function loadImageFromFile(file) {
	if (typeof createImageBitmap === 'function') {
		return await createImageBitmap(file);
	}
	// Fallback for older browsers
	return await new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = (e) => {
			URL.revokeObjectURL(url);
			reject(e);
		};
		img.src = url;
	});
}

async function resizeAndCompressImage(file, { maxWidth, maxHeight, quality }) {
	// Only handle images we can decode in-browser
	if (!file || !file.type || !file.type.startsWith('image/')) return file;

	const bitmapOrImg = await loadImageFromFile(file);
	const srcWidth = bitmapOrImg.width;
	const srcHeight = bitmapOrImg.height;
	if (!srcWidth || !srcHeight) return file;

	const scale = Math.min(maxWidth / srcWidth, maxHeight / srcHeight, 1);
	const targetWidth = Math.max(1, Math.round(srcWidth * scale));
	const targetHeight = Math.max(1, Math.round(srcHeight * scale));

	// If already small-ish, keep original
	if (scale === 1 && file.size <= 450 * 1024) return file;

	const canvas = document.createElement('canvas');
	canvas.width = targetWidth;
	canvas.height = targetHeight;
	const ctx = canvas.getContext('2d', { alpha: true });
	if (!ctx) return file;

	ctx.drawImage(bitmapOrImg, 0, 0, targetWidth, targetHeight);

	// Prefer WebP (smaller + supports alpha); fallback to JPEG if not supported
	const preferredMime = 'image/webp';
	const fallbackMime = 'image/jpeg';
	const tryMime = async (mime) => {
		return await new Promise((resolve) => {
			canvas.toBlob((blob) => resolve(blob || null), mime, quality);
		});
	};

	let outBlob = await tryMime(preferredMime);
	let outType = preferredMime;
	if (!outBlob) {
		outBlob = await tryMime(fallbackMime);
		outType = fallbackMime;
	}
	if (!outBlob) return file;

	// If compression didn't help, keep original
	if (outBlob.size >= file.size && scale === 1) return file;

	const base = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ''));
	const outName = `${base}.${fileExtForMime(outType)}`;
	return new File([outBlob], outName, { type: outType, lastModified: Date.now() });
}

function useCategories(refresh) {
	const [categories, setCategories] = React.useState([]);
	React.useEffect(() => {
		(async () => {
			const snap = await getDocs(collection(db, 'categories'));
			const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
			list.sort((a,b)=>{
				// Safe name extraction for sorting
				const getName = (item) => {
					if (!item || !item.name) return '';
					if (typeof item.name === 'object') {
						return item.name.ro || item.name.en || item.name.ar || '';
					}
					return item.name || '';
				};
				const an = getName(a).toString().toLowerCase();
				const bn = getName(b).toString().toLowerCase();
				return an.localeCompare(bn);
			});
			setCategories(list);
		})();
	}, [refresh]);
	return categories;
}

function useProducts(refresh) {
	const [products, setProducts] = React.useState([]);
	React.useEffect(() => {
		(async () => {
			const snap = await getDocs(collection(db, 'products'));
			const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
			list.sort((a,b)=>{
				const an = (a?.name_ro || (a?.name?.ro) || (a?.name?.en) || a?.name || '').toString().toLowerCase();
				const bn = (b?.name_ro || (b?.name?.ro) || (b?.name?.en) || b?.name || '').toString().toLowerCase();
				return an.localeCompare(bn);
			});
			setProducts(list);
		})();
	}, [refresh]);
	return products;
}

function buildPathMap(categories, lang) {
	const idToCat = new Map(categories.map(c => [c.id, c]));
	const getName = (c) => {
		if (!c || !c.name) return '';
		if (typeof c.name === 'object' && c.name !== null) {
			return c.name[lang] || c.name.en || c.name.ro || c.name.ar || '';
		}
		return c.name || '';
	};
	function fullPath(cat) {
		const parts = [getName(cat)];
		let p = cat.parentId ? idToCat.get(cat.parentId) : null;
		while (p) { parts.unshift(getName(p)); p = p.parentId ? idToCat.get(p.parentId) : null; }
		return parts.join(' / ');
	}
	return categories.map(c => ({ id: c.id, label: fullPath(c) }));
}

function useFooterSettings(refresh) {
	const [settings, setSettings] = React.useState(null);
	React.useEffect(() => {
		(async () => {
			const docSnap = await getDoc(doc(db, 'settings', 'footer'));
			if (docSnap.exists()) {
				setSettings(docSnap.data());
			} else {
				// Default values
				setSettings({
					address: 'Calea Vitan 174, Bucharest, Romania',
					phone: '+40 7xx xxx xxx',
					email: 'info@tress2.com',
					hoursMonThu: '11:00–22:00',
					hoursFriSat: '11:00–23:00',
					hoursSun: '12:00–21:00',
					instagramUrl: '',
					facebookUrl: '',
					tiktokUrl: ''
				});
			}
		})();
	}, [refresh]);
	return settings;
}

function useAppSettings(refresh) {
	const [settings, setSettings] = React.useState(null);
	React.useEffect(() => {
		(async () => {
			try {
				const docSnap = await getDoc(doc(db, 'settings', 'app'));
				if (docSnap.exists()) {
					setSettings(docSnap.data());
				} else {
					setSettings({
						showProductPlaceholderImage: true
					});
				}
			} catch (e) {
				console.error('Error loading app settings:', e);
				setSettings({ showProductPlaceholderImage: true });
			}
		})();
	}, [refresh]);
	return settings;
}

export default function Admin() {
	const { user } = useAuth();
	const { showToast, ToastComponent } = useToast();
	const [refreshKey, setRefreshKey] = React.useState(0);
	const categories = useCategories(refreshKey);
	const products = useProducts(refreshKey);
	const footerSettings = useFooterSettings(refreshKey);
	const appSettings = useAppSettings(refreshKey);
	const [adminLang, setAdminLang] = React.useState('ro');
	const pathOptions = React.useMemo(() => buildPathMap(categories, adminLang), [categories, adminLang]);
	const [listFilterCategoryId, setListFilterCategoryId] = React.useState('');
	const [listProductSearch, setListProductSearch] = React.useState('');

	const listFilterCategoryIdSet = React.useMemo(() => {
		if (!listFilterCategoryId) return null;
		const childrenByParent = new Map();
		for (const c of categories) {
			const pid = c.parentId || null;
			if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
			childrenByParent.get(pid).push(c.id);
		}

		const visited = new Set();
		const queue = [listFilterCategoryId];
		while (queue.length) {
			const id = queue.shift();
			if (!id || visited.has(id)) continue;
			visited.add(id);
			const kids = childrenByParent.get(id) || [];
			for (const kid of kids) queue.push(kid);
		}
		return visited;
	}, [categories, listFilterCategoryId]);

	const filteredCategories = React.useMemo(() => {
		if (!listFilterCategoryIdSet) return categories;
		return categories.filter(c => listFilterCategoryIdSet.has(c.id));
	}, [categories, listFilterCategoryIdSet]);

	const filteredProducts = React.useMemo(() => {
		if (!listFilterCategoryIdSet) return products;
		return products.filter(p => p.categoryId && listFilterCategoryIdSet.has(p.categoryId));
	}, [products, listFilterCategoryIdSet]);

	const searchedProducts = React.useMemo(() => {
		const q = (listProductSearch || '').trim().toLowerCase();
		if (!q) return filteredProducts;
		const toText = (v) => (v == null ? '' : String(v));
		return filteredProducts.filter((p) => {
			const parts = [];
			if (p?.name && typeof p.name === 'object' && p.name !== null) parts.push(p.name.en, p.name.ro, p.name.ar);
			if (p?.name && typeof p.name === 'string') parts.push(p.name);
			parts.push(p?.name_ro);
			const hay = toText(parts.filter(Boolean).join(' ')).toLowerCase();
			return hay.includes(q);
		});
	}, [filteredProducts, listProductSearch]);

	// Helper function to safely get name
	const getName = React.useCallback((item) => {
		if (!item) return '';
		if (typeof item.name === 'object' && item.name !== null) {
			return item.name[adminLang] || item.name.en || item.name.ro || item.name.ar || '';
		}
		return item.name || '';
	}, [adminLang]);

	const getFilenameFromUrl = React.useCallback((url) => {
		if (!url) return '';
		const toText = (v) => (v == null ? '' : String(v));
		const raw = toText(url);
		try {
			const u = new URL(raw, window.location.origin);
			const path = u.pathname || '';
			// Firebase Storage download URLs look like: .../o/<encodedPath>?alt=media...
			const idx = path.indexOf('/o/');
			if (idx >= 0) {
				const encoded = path.slice(idx + 3);
				const decoded = decodeURIComponent(encoded);
				const parts = decoded.split('/').filter(Boolean);
				return parts[parts.length - 1] || decoded;
			}
			const parts = path.split('/').filter(Boolean);
			return decodeURIComponent(parts[parts.length - 1] || '');
		} catch {
			// Fallback: try best-effort parsing without URL()
			const clean = raw.split('?')[0] || raw;
			const parts = clean.split('/').filter(Boolean);
			return decodeURIComponent(parts[parts.length - 1] || '');
		}
	}, []);

	// Category form state
	const [editingCat, setEditingCat] = React.useState(null);
	const [catNames, setCatNames] = React.useState({ en: '', ro: '', ar: '' });
	const [parentId, setParentId] = React.useState('');
	const [catImage, setCatImage] = React.useState(null);
	const [catMenuPageMode, setCatMenuPageMode] = React.useState('products_only');
	const [catMenuPageImages, setCatMenuPageImages] = React.useState([]);
	const [catMenuPageNewFiles, setCatMenuPageNewFiles] = React.useState([]);
	const [catMenuPageInheritToChildren, setCatMenuPageInheritToChildren] = React.useState(false);
	const [catMenuPageChildrenMode, setCatMenuPageChildrenMode] = React.useState('image_only');

	// Product form state
	const [editingProd, setEditingProd] = React.useState(null);
	const [prodNames, setProdNames] = React.useState({ en: '', ro: '', ar: '' });
	const [prodDescs, setProdDescs] = React.useState({ en: '', ro: '', ar: '' });
	const [prodPrice, setProdPrice] = React.useState('');
	const [prodCatId, setProdCatId] = React.useState('');
	const [prodImage, setProdImage] = React.useState(null);

	// Footer settings state
	const [footerAddress, setFooterAddress] = React.useState('');
	const [footerPhone, setFooterPhone] = React.useState('');
	const [footerEmail, setFooterEmail] = React.useState('');
	const [hoursMonThu, setHoursMonThu] = React.useState('');
	const [hoursFriSat, setHoursFriSat] = React.useState('');
	const [hoursSun, setHoursSun] = React.useState('');
	const [instagramUrl, setInstagramUrl] = React.useState('');
	const [facebookUrl, setFacebookUrl] = React.useState('');
	const [tiktokUrl, setTiktokUrl] = React.useState('');

	// App settings state
	const [showProductPlaceholderImage, setShowProductPlaceholderImage] = React.useState(true);

	// Bulk import state
	const [importing, setImporting] = React.useState(false);
	const [importProgress, setImportProgress] = React.useState('');

	// Load footer settings into form when available
	React.useEffect(() => {
		if (footerSettings) {
			setFooterAddress(footerSettings.address || '');
			setFooterPhone(footerSettings.phone || '');
			setFooterEmail(footerSettings.email || '');
			setHoursMonThu(footerSettings.hoursMonThu || '');
			setHoursFriSat(footerSettings.hoursFriSat || '');
			setHoursSun(footerSettings.hoursSun || '');
			setInstagramUrl(footerSettings.instagramUrl || '');
			setFacebookUrl(footerSettings.facebookUrl || '');
			setTiktokUrl(footerSettings.tiktokUrl || '');
		}
	}, [footerSettings]);

	React.useEffect(() => {
		if (appSettings) {
			setShowProductPlaceholderImage(appSettings.showProductPlaceholderImage !== false);
		}
	}, [appSettings]);

	async function handleSaveAppSettings(e) {
		e.preventDefault();
		try {
			await setDoc(doc(db, 'settings', 'app'), {
				showProductPlaceholderImage: !!showProductPlaceholderImage,
				updatedAt: Date.now()
			}, { merge: true });
			showToast('App settings saved successfully!', 'success');
			setRefreshKey(prev => prev + 1);
		} catch (error) {
			console.error('Error saving app settings:', error);
			showToast('Failed to save app settings. Please try again.', 'error');
		}
	}

	async function uploadToStorage(file, folder) {
		const isProduct = folder === 'product-images';
		const isMenuPage = folder === 'menu-page-images';
		const optimized = await resizeAndCompressImage(file, {
			maxWidth: isMenuPage ? 2400 : (isProduct ? 1600 : 1200),
			maxHeight: isMenuPage ? 2400 : (isProduct ? 1600 : 1200),
			quality: isMenuPage ? 0.86 : 0.82
		});
		const safeName = sanitizeFilename(optimized?.name || file?.name);
		const fileRef = ref(storage, `${folder}/${Date.now()}_${safeName}`);
		const res = await uploadBytes(fileRef, optimized, {
			contentType: optimized?.type || file?.type || undefined,
			cacheControl: 'public,max-age=31536000,immutable'
		});
		return await getDownloadURL(res.ref);
	}

	async function handleAddCategory(e) {
		e.preventDefault();
		
		// Validate all languages are filled
		if (!catNames.en.trim() || !catNames.ro.trim() || !catNames.ar.trim()) {
			showToast('Please fill in category name for all languages (EN, RO, AR)', 'error');
			return;
		}
		
		try {
			let imageUrl = editingCat?.imageUrl || '';
			if (catImage) imageUrl = await uploadToStorage(catImage, 'category-images');

			let menuPageImages = Array.isArray(catMenuPageImages) ? [...catMenuPageImages] : [];
			if (Array.isArray(catMenuPageNewFiles) && catMenuPageNewFiles.length > 0) {
				for (const f of catMenuPageNewFiles) {
					// eslint-disable-next-line no-await-in-loop
					const url = await uploadToStorage(f, 'menu-page-images');
					if (url) menuPageImages.push(url);
				}
			}
			
			if (editingCat) {
				await updateDoc(doc(db, 'categories', editingCat.id), {
					name: {
						en: catNames.en.trim(),
						ro: catNames.ro.trim(),
						ar: catNames.ar.trim()
					},
					name_ro: catNames.ro.trim(),
					parentId: parentId || null,
					...(catImage ? { imageUrl } : {}),
					menuPageMode: catMenuPageMode || 'products_only',
					menuPageImages,
					menuPageInheritToChildren: !!catMenuPageInheritToChildren,
					menuPageChildrenMode: catMenuPageChildrenMode || 'image_only'
				});
				showToast('Category updated successfully!', 'success');
			} else {
				await addDoc(collection(db, 'categories'), {
					name: {
						en: catNames.en.trim(),
						ro: catNames.ro.trim(),
						ar: catNames.ar.trim()
					},
					name_ro: catNames.ro.trim(),
					parentId: parentId || null,
					imageUrl: imageUrl || '',
					menuPageMode: catMenuPageMode || 'products_only',
					menuPageImages,
					menuPageInheritToChildren: !!catMenuPageInheritToChildren,
					menuPageChildrenMode: catMenuPageChildrenMode || 'image_only',
					createdAt: Date.now()
				});
				showToast('Category added successfully!', 'success');
			}
			
			setCatNames({ en: '', ro: '', ar: '' });
			setParentId('');
			setCatImage(null);
			setCatMenuPageMode('products_only');
			setCatMenuPageImages([]);
			setCatMenuPageNewFiles([]);
			setCatMenuPageInheritToChildren(false);
			setCatMenuPageChildrenMode('image_only');
			setEditingCat(null);
			e.target.reset();
			setRefreshKey(prev => prev + 1);
		} catch (error) {
			console.error('Error saving category:', error);
			showToast('Failed to save category. Please try again.', 'error');
		}
	}

	async function handleDeleteCategory(id) {
		if (!window.confirm('Delete this category? All subcategories and products will remain.')) return;
		try {
			await deleteDoc(doc(db, 'categories', id));
			setRefreshKey(prev => prev + 1);
			showToast('Category deleted successfully!', 'success');
		} catch (error) {
			console.error('Error deleting category:', error);
			showToast('Failed to delete category. Please try again.', 'error');
		}
	}

	function handleEditCategory(cat) {
		setEditingCat(cat);
		setCatMenuPageMode(cat?.menuPageMode || 'products_only');
		setCatMenuPageImages(Array.isArray(cat?.menuPageImages) ? cat.menuPageImages.filter(Boolean) : []);
		setCatMenuPageNewFiles([]);
		setCatMenuPageInheritToChildren(!!cat?.menuPageInheritToChildren);
		setCatMenuPageChildrenMode(cat?.menuPageChildrenMode || 'image_only');
		if (typeof cat.name === 'object') {
			setCatNames({
				en: cat.name.en || '',
				ro: cat.name.ro || '',
				ar: cat.name.ar || ''
			});
		} else {
			setCatNames({ en: '', ro: cat.name || '', ar: '' });
		}
		setParentId(cat.parentId || '');
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	async function handleAddProduct(e) {
		e.preventDefault();
		
		// Validate all languages are filled
		if (!prodNames.en.trim() || !prodNames.ro.trim() || !prodNames.ar.trim()) {
			showToast('Please fill in product name for all languages (EN, RO, AR)', 'error');
			return;
		}
		if (!prodDescs.en.trim() || !prodDescs.ro.trim() || !prodDescs.ar.trim()) {
			showToast('Please fill in product description for all languages (EN, RO, AR)', 'error');
			return;
		}
		
		try {
			let imageUrl = editingProd?.imageUrl || '';
			if (prodImage) imageUrl = await uploadToStorage(prodImage, 'product-images');
			
			if (editingProd) {
				await updateDoc(doc(db, 'products', editingProd.id), {
					name: {
						en: prodNames.en.trim(),
						ro: prodNames.ro.trim(),
						ar: prodNames.ar.trim()
					},
					name_ro: prodNames.ro.trim(),
					description: {
						en: prodDescs.en.trim(),
						ro: prodDescs.ro.trim(),
						ar: prodDescs.ar.trim()
					},
					price: parseFloat(prodPrice),
					categoryId: prodCatId || null,
					...(prodImage ? { imageUrl } : {})
				});
				showToast('Product updated successfully!', 'success');
			} else {
				await addDoc(collection(db, 'products'), {
					name: {
						en: prodNames.en.trim(),
						ro: prodNames.ro.trim(),
						ar: prodNames.ar.trim()
					},
					name_ro: prodNames.ro.trim(),
					description: {
						en: prodDescs.en.trim(),
						ro: prodDescs.ro.trim(),
						ar: prodDescs.ar.trim()
					},
					price: parseFloat(prodPrice),
					imageUrl: imageUrl || '',
					categoryId: prodCatId || null,
					createdAt: Date.now()
				});
				showToast('Product added successfully!', 'success');
			}
			
			setProdNames({ en: '', ro: '', ar: '' }); setProdDescs({ en: '', ro: '', ar: '' }); setProdPrice(''); setProdCatId(''); setProdImage(null); setEditingProd(null);
			e.target.reset();
			setRefreshKey(prev => prev + 1);
		} catch (error) {
			console.error('Error saving product:', error);
			showToast('Failed to save product. Please try again.', 'error');
		}
	}

async function handleSaveFooter(e) {
	e.preventDefault();
	try {
		await setDoc(doc(db, 'settings', 'footer'), {
			address: footerAddress.trim(),
			phone: footerPhone.trim(),
			email: footerEmail.trim(),
			hoursMonThu: hoursMonThu.trim(),
			hoursFriSat: hoursFriSat.trim(),
			hoursSun: hoursSun.trim(),
			instagramUrl: instagramUrl.trim(),
			facebookUrl: facebookUrl.trim(),
			tiktokUrl: tiktokUrl.trim(),
			updatedAt: Date.now()
		});
		showToast('Footer settings saved successfully!', 'success');
		setRefreshKey(prev => prev + 1);
	} catch (error) {
		console.error('Error saving footer:', error);
		showToast('Failed to save footer settings. Please try again.', 'error');
	}
}

	async function handleDeleteProduct(id) {
		if (!window.confirm('Delete this product?')) return;
		try {
			await deleteDoc(doc(db, 'products', id));
			setRefreshKey(prev => prev + 1);
			showToast('Product deleted successfully!', 'success');
		} catch (error) {
			console.error('Error deleting product:', error);
			showToast('Failed to delete product. Please try again.', 'error');
		}
	}

	function handleEditProduct(prod) {
		setEditingProd(prod);
		setProdImage(null);
		if (typeof prod.name === 'object') {
			setProdNames({ en: prod.name.en || '', ro: prod.name.ro || '', ar: prod.name.ar || '' });
		} else {
			setProdNames({ en: '', ro: prod.name || '', ar: '' });
		}
		if (typeof prod.description === 'object') {
			setProdDescs({ en: prod.description.en || '', ro: prod.description.ro || '', ar: prod.description.ar || '' });
		} else {
			setProdDescs({ en: prod.description || '', ro: '', ar: '' });
		}
		setProdPrice(prod.price.toString());
		setProdCatId(prod.categoryId || '');
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	async function handleBulkImport() {
		if (!window.confirm('This will import all menu items from the menu files. Continue?')) return;
		
		setImporting(true);
		setImportProgress('Loading menu files...');
		
		try {
			// Fetch the menu files
			const [enResponse, roResponse, arResponse] = await Promise.all([
				fetch('/Lotus_Menu_English.txt'),
				fetch('/Lotus_Menu_Romanian.txt'),
				fetch('/Lotus_Menu_Arabic.txt')
			]);
			
			const [enText, roText, arText] = await Promise.all([
				enResponse.text(),
				roResponse.text(),
				arResponse.text()
			]);
			
			setImportProgress('Parsing menu data...');
			const { categories, products, issues } = parseMenuData(enText, roText, arText);
			if (issues && issues.length > 0) {
				console.error('Menu parse issues:', issues);
				setImportProgress(`Parsing failed. Found ${issues.length} mismatch(es). Not importing to avoid wrong translations.\n\nFirst issues:\n- ${issues.slice(0, 10).join('\n- ')}`);
				showToast(`Parsing failed (${issues.length} mismatch(es)). Not imported. Check console.`, 'error');
				return;
			}
			
			setImportProgress(`Found ${categories.length} categories and ${products.length} products. Importing...`);
			
			const results = await importMenuToFirestore(categories, products);
			
			setImportProgress(`Import complete! Added ${results.categoriesAdded} categories and ${results.productsAdded} products.`);
			
			if (results.errors.length > 0) {
				console.error('Import errors:', results.errors);
				showToast(`Import completed with ${results.errors.length} errors. Check console.`, 'error');
			} else {
				showToast(`Successfully imported ${results.categoriesAdded} categories and ${results.productsAdded} products!`, 'success');
			}
			
			setRefreshKey(prev => prev + 1);
		} catch (error) {
			console.error('Bulk import error:', error);
			showToast('Failed to import menu. See console for details.', 'error');
			setImportProgress('Import failed: ' + error.message);
		} finally {
			setImporting(false);
			setTimeout(() => setImportProgress(''), 5000);
		}
	}

	async function handleManualFullMenuImport() {
		if (!window.confirm('This will import the FULL menu using the manual JSON seeds (safe to re-run). Continue?')) return;

		setImporting(true);
		setImportProgress('Starting manual full-menu import...');
		try {
			const datasets = [
				{ label: 'Soups/Breakfast/Salads', data: manualMenuSeed },
				{ label: 'Appetizers', data: manualMenuAppetizers },
				{ label: 'Grill/International/Sides/Pasta', data: manualMenuCatsMore },
				{ label: 'Burgers', data: manualMenuBurgers },
				{ label: 'Desserts/Coffee/Freak shakes/Lemonades', data: manualMenuDessertsDrinks },
				{ label: 'Soft drinks/Cocktails/Mocktails', data: manualMenuSoftDrinksCocktails },
				{ label: 'Sauces', data: manualMenuSauces }
			];

			let totalCategories = 0;
			let totalProducts = 0;
			const allErrors = [];

			for (const ds of datasets) {
				setImportProgress(`Importing ${ds.label}...`);
				// eslint-disable-next-line no-await-in-loop
				const results = await importManualMenuJsonToFirestore(ds.data);
				totalCategories += results.categoriesAdded || 0;
				totalProducts += results.productsAdded || 0;
				if (results.errors?.length) {
					allErrors.push(...results.errors.map(e => `[${ds.label}] ${e}`));
				}
			}

			setImportProgress(`Manual full-menu import complete! Upserted ${totalCategories} categories and ${totalProducts} items.`);
			if (allErrors.length > 0) {
				console.error('Manual full-menu import errors:', allErrors);
				showToast(`Manual full-menu import completed with ${allErrors.length} errors. Check console.`, 'error');
			} else {
				showToast(`Manual full-menu import completed successfully!`, 'success');
			}
			setRefreshKey(prev => prev + 1);
		} catch (error) {
			console.error('Manual full-menu import error:', error);
			showToast('Failed to import manual full menu. See console for details.', 'error');
			setImportProgress('Import failed: ' + error.message);
		} finally {
			setImporting(false);
			setTimeout(() => setImportProgress(''), 5000);
		}
	}

	async function handleClearAllData() {
		if (!window.confirm('⚠️ WARNING: This will delete ALL categories and products! Are you absolutely sure?')) return;
		if (!window.confirm('This action cannot be undone! Type confirmation needed.')) return;
		
		try {
			await clearAllMenuData();
			showToast('All menu data cleared successfully!', 'success');
			setRefreshKey(prev => prev + 1);
		} catch (error) {
			console.error('Clear data error:', error);
			showToast('Failed to clear menu data.', 'error');
		}
	}

	return (
		<div className="min-h-screen marble-bg marble-overlay text-off-white">
	<header className="sticky top-0 z-30 bg-marble-black/90 backdrop-blur-md border-b border-gold/20">
		<div className="px-4 py-4">
			<div className="flex items-center justify-between mb-3">
				<div className="flex-1 flex items-center justify-center">
					<img src="/lotus-logo.png" alt="Lotus" className="h-12 w-auto cursor-pointer active:opacity-70" onClick={() => window.location.href = '/'} />
				</div>
			</div>
			<div className="flex items-center justify-between">
				<h2 className="font-cinzel text-lg text-gold">Admin Panel</h2>
				<div className="flex items-center gap-3">
					<div className="flex items-center gap-2 bg-black/40 border border-gold/30 px-2 py-1 rounded-md">
						<button onClick={() => setAdminLang('ro')} className={`text-sm ${adminLang==='ro'?'text-gold':'text-off-white'}`}>RO</button>
						<span className="text-muted-gray">|</span>
						<button onClick={() => setAdminLang('en')} className={`text-sm ${adminLang==='en'?'text-gold':'text-off-white'}`}>EN</button>
						<span className="text-muted-gray">|</span>
						<button onClick={() => setAdminLang('ar')} className={`text-sm ${adminLang==='ar'?'text-gold':'text-off-white'}`}>AR</button>
					</div>
					<span className="text-sm text-muted-gray">{user?.email}</span>
					<button onClick={signOutUser} className="px-3 py-1.5 bg-gold text-black rounded active:opacity-80 text-sm">Sign out</button>
				</div>
			</div>
		</div>
		<div className="gold-line mx-4" />
	</header>

			<main className="px-4 py-8 space-y-8">
				{/* Forms Section */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
					<section className="bg-marble-black/80 border border-gold/30 rounded-xl p-6">
						<h2 className="font-cinzel text-xl text-gold mb-4">{editingCat ? 'Edit Category' : 'Add Category'}</h2>
						<form onSubmit={handleAddCategory} className="space-y-4">
							<div>
								<div className="flex items-center gap-2 mb-2 text-sm">
									<span className="text-muted-gray">Language</span>
									<div className="flex items-center gap-2 bg-black/40 border border-gold/20 px-2 py-1 rounded">
										<button type="button" onClick={()=>setAdminLang('ro')} className={`${adminLang==='ro'?'text-gold':'text-off-white'}`}>RO</button>
										<button type="button" onClick={()=>setAdminLang('en')} className={`${adminLang==='en'?'text-gold':'text-off-white'}`}>EN</button>
										<button type="button" onClick={()=>setAdminLang('ar')} className={`${adminLang==='ar'?'text-gold':'text-off-white'}`}>AR</button>
									</div>
								</div>
								<input value={catNames[adminLang]}
									onChange={e=>setCatNames(prev=>({ ...prev, [adminLang]: e.target.value }))}
									placeholder={`Category name (${adminLang.toUpperCase()})`} 
									className="w-full px-3 py-2 rounded bg-black/40 border border-gold/20 focus:outline-none text-off-white" required />
							</div>
							<select value={parentId} onChange={e=>setParentId(e.target.value)} className="w-full px-3 py-2 rounded bg-black/40 border border-gold/20 focus:outline-none text-off-white">
								<option value="">No parent (top-level)</option>
								{pathOptions.filter(o => o.id !== editingCat?.id).map(o=> (
									<option key={o.id} value={o.id}>{o.label}</option>
								))}
							</select>
							<div>
								<label className="block text-sm text-muted-gray mb-1">Optional image {editingCat?.imageUrl && '(leave empty to keep current)'}</label>
								<input type="file" accept="image/*" onChange={e=>setCatImage(e.target.files?.[0]||null)} className="block w-full text-sm text-off-white" />
							</div>

							<div className="bg-black/30 border border-gold/20 rounded-lg p-4 space-y-4">
								<div className="flex items-start justify-between gap-3">
									<div>
										<p className="text-off-white font-medium">Big image (menu page)</p>
										<p className="text-xs text-muted-gray">Shows one (or multiple) full-screen image pages on the category screen.</p>
									</div>
									<button
										type="button"
										onClick={() => { setCatMenuPageMode('image_only'); setCatMenuPageInheritToChildren(true); setCatMenuPageChildrenMode('image_only'); }}
										className="px-3 py-1.5 bg-gold/20 text-gold border border-gold/30 rounded hover:bg-gold/30 text-xs whitespace-nowrap"
									>
										Quick: image only + subcats
									</button>
								</div>

								<div className="space-y-2">
									<p className="text-sm text-muted-gray">Display</p>
									<div className="space-y-2">
										<label className="flex items-start gap-3 bg-black/40 border border-gold/10 rounded px-3 py-2 cursor-pointer">
											<input type="radio" name="menuPageMode" checked={catMenuPageMode==='products_only'} onChange={()=>setCatMenuPageMode('products_only')} className="mt-1" />
											<div>
												<p className="text-off-white text-sm">Products only</p>
												<p className="text-xs text-muted-gray">No big image.</p>
											</div>
										</label>
										<label className="flex items-start gap-3 bg-black/40 border border-gold/10 rounded px-3 py-2 cursor-pointer">
											<input type="radio" name="menuPageMode" checked={catMenuPageMode==='image_and_products'} onChange={()=>setCatMenuPageMode('image_and_products')} className="mt-1" />
											<div>
												<p className="text-off-white text-sm">Image + products</p>
												<p className="text-xs text-muted-gray">Shows big image first, then products/subcategories.</p>
											</div>
										</label>
										<label className="flex items-start gap-3 bg-black/40 border border-gold/10 rounded px-3 py-2 cursor-pointer">
											<input type="radio" name="menuPageMode" checked={catMenuPageMode==='image_only'} onChange={()=>setCatMenuPageMode('image_only')} className="mt-1" />
											<div>
												<p className="text-off-white text-sm">Image only</p>
												<p className="text-xs text-muted-gray">Only the big image (no products).</p>
											</div>
										</label>
									</div>
								</div>

								<div className="space-y-2">
									<label className="block text-sm text-muted-gray">Menu page image(s)</label>
									<input
										type="file"
										accept="image/*"
										multiple
										onChange={(e) => setCatMenuPageNewFiles(Array.from(e.target.files || []))}
										className="block w-full text-sm text-off-white"
									/>
									<p className="text-xs text-muted-gray">Tip: you can upload 2 images for 2 pages.</p>
								</div>

								{Array.isArray(catMenuPageImages) && catMenuPageImages.length > 0 ? (
									<div className="space-y-2">
										<div className="flex items-center justify-between gap-3">
											<p className="text-sm text-muted-gray">Current images</p>
											<button
												type="button"
												onClick={() => setCatMenuPageImages([])}
												className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 text-xs"
											>
												Remove all
											</button>
										</div>
										<div className="grid grid-cols-2 gap-2">
											{catMenuPageImages.map((url, idx) => (
												<div key={`${url}-${idx}`} className="flex items-center gap-2 bg-black/40 border border-gold/10 rounded p-2">
													<img src={url} alt="Menu page" className="h-12 w-12 rounded object-cover border border-gold/10" loading="lazy" decoding="async" />
													<div className="flex-1 min-w-0">
														<p className="text-xs text-off-white/80 truncate">{getFilenameFromUrl(url) || url}</p>
														<button
															type="button"
															onClick={() => setCatMenuPageImages(prev => (Array.isArray(prev) ? prev.filter((_, i) => i !== idx) : []))}
															className="mt-1 px-2 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 text-xs"
														>
															Remove
														</button>
													</div>
												</div>
											))}
										</div>
									</div>
								) : (
									<p className="text-xs text-muted-gray">No menu page images set.</p>
								)}

								<div className="bg-black/40 border border-gold/10 rounded p-3 space-y-2">
									<label className="flex items-center gap-2 text-sm text-off-white cursor-pointer">
										<input
											type="checkbox"
											checked={catMenuPageInheritToChildren}
											onChange={(e) => setCatMenuPageInheritToChildren(e.target.checked)}
										/>
										Apply this big image to all subcategories
									</label>
									{catMenuPageInheritToChildren ? (
										<div>
											<label className="block text-xs text-muted-gray mb-1">Subcategories display</label>
											<select
												value={catMenuPageChildrenMode}
												onChange={(e) => setCatMenuPageChildrenMode(e.target.value)}
												className="w-full px-3 py-2 rounded bg-black/40 border border-gold/20 focus:outline-none text-off-white"
											>
												<option value="image_only">Image only</option>
												<option value="image_and_products">Image + products</option>
												<option value="products_only">Products only</option>
											</select>
											<p className="text-xs text-muted-gray mt-1">Subcategories can still override by setting their own big image/mode.</p>
										</div>
									) : null}
								</div>
							</div>
							<div className="flex gap-2">
								<button type="submit" className="px-4 py-2 bg-gold text-black rounded hover:bg-deep-gold flex-1">{editingCat ? 'Update' : 'Add'} Category</button>
								{editingCat && (
									<button type="button" onClick={() => { setEditingCat(null); setCatNames({ en:'', ro:'', ar:'' }); setParentId(''); setCatImage(null); setCatMenuPageMode('products_only'); setCatMenuPageImages([]); setCatMenuPageNewFiles([]); setCatMenuPageInheritToChildren(false); setCatMenuPageChildrenMode('image_only'); }} className="px-4 py-2 bg-muted-gray/20 text-off-white rounded hover:bg-muted-gray/30">Cancel</button>
								)}
							</div>
						</form>
					</section>

					<section className="bg-marble-black/80 border border-gold/30 rounded-xl p-6">
						<h2 className="font-cinzel text-xl text-gold mb-4">{editingProd ? 'Edit Product' : 'Add Product'}</h2>
						<form onSubmit={handleAddProduct} className="space-y-4">
							<div>
								<div className="flex items-center gap-2 mb-2 text-sm">
									<span className="text-muted-gray">Language</span>
									<div className="flex items-center gap-2 bg-black/40 border border-gold/20 px-2 py-1 rounded">
										<button type="button" onClick={()=>setAdminLang('ro')} className={`${adminLang==='ro'?'text-gold':'text-off-white'}`}>RO</button>
										<button type="button" onClick={()=>setAdminLang('en')} className={`${adminLang==='en'?'text-gold':'text-off-white'}`}>EN</button>
										<button type="button" onClick={()=>setAdminLang('ar')} className={`${adminLang==='ar'?'text-gold':'text-off-white'}`}>AR</button>
									</div>
								</div>
								<input value={prodNames[adminLang]}
									onChange={e=>setProdNames(prev=>({ ...prev, [adminLang]: e.target.value }))}
									placeholder={`Product name (${adminLang.toUpperCase()})`} 
									className="w-full px-3 py-2 rounded bg-black/40 border border-gold/20 focus:outline-none text-off-white" required />
								<textarea value={prodDescs[adminLang]}
									onChange={e=>setProdDescs(prev=>({ ...prev, [adminLang]: e.target.value }))}
									placeholder={`Description (${adminLang.toUpperCase()})`} 
									className="w-full px-3 py-2 rounded bg-black/40 border border-gold/20 focus:outline-none text-off-white" rows="3" />
							</div>
							<input type="number" step="0.01" value={prodPrice} onChange={e=>setProdPrice(e.target.value)} placeholder="Price" className="w-full px-3 py-2 rounded bg-black/40 border border-gold/20 focus:outline-none text-off-white" required />
							<select value={prodCatId} onChange={e=>setProdCatId(e.target.value)} className="w-full px-3 py-2 rounded bg-black/40 border border-gold/20 focus:outline-none text-off-white" required>
								<option value="" disabled>Select category</option>
								{pathOptions.map(o=> (
									<option key={o.id} value={o.id}>{o.label}</option>
								))}
							</select>
							<div>
								<label className="block text-sm text-muted-gray mb-1">Product image {editingProd?.imageUrl && '(leave empty to keep current)'}</label>
								<input type="file" accept="image/*" onChange={e=>setProdImage(e.target.files?.[0]||null)} className="block w-full text-sm text-off-white" />
								{editingProd?.imageUrl ? (
									<p className="text-xs text-muted-gray mt-1">Current file: <span className="text-off-white/80">{getFilenameFromUrl(editingProd.imageUrl) || 'Unknown'}</span></p>
								) : null}
								{prodImage ? (
									<p className="text-xs text-muted-gray mt-1">Selected file: <span className="text-off-white/80">{prodImage.name}</span></p>
								) : null}
							</div>
							<div className="flex gap-2">
								<button type="submit" className="px-4 py-2 bg-gold text-black rounded hover:bg-deep-gold flex-1">{editingProd ? 'Update' : 'Add'} Product</button>
								{editingProd && (
									<button type="button" onClick={() => { setEditingProd(null); setProdNames({ en:'', ro:'', ar:'' }); setProdDescs({ en:'', ro:'', ar:'' }); setProdPrice(''); setProdCatId(''); setProdImage(null); }} className="px-4 py-2 bg-muted-gray/20 text-off-white rounded hover:bg-muted-gray/30">Cancel</button>
								)}
							</div>
						</form>
					</section>
				</div>

				{/* Bulk Import Section */}
				<section className="bg-marble-black/80 border border-gold/30 rounded-xl p-6 mb-8">
					<h2 className="font-cinzel text-xl text-gold mb-4">Bulk Menu Import</h2>
					<div className="space-y-4">
						<p className="text-muted-gray text-sm">
							Import all categories and products from the menu text files (Lotus_Menu_English.txt, Lotus_Menu_Romanian.txt, Lotus_Menu_Arabic.txt).
							Make sure these files are in the public folder.
						</p>
						<div className="flex gap-3">
							<button 
								onClick={handleBulkImport}
								disabled={importing}
								className="px-6 py-3 bg-gold text-black rounded hover:bg-deep-gold disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
							>
								{importing ? 'Importing...' : 'Import Full Menu'}
							</button>
							<button 
								onClick={handleManualFullMenuImport}
								disabled={importing}
								className="px-6 py-3 bg-gold/20 text-gold border border-gold/40 rounded hover:bg-gold/30 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
							>
								Import Full Menu (Manual JSON)
							</button>
							<button 
								onClick={handleClearAllData}
								disabled={importing}
								className="px-6 py-3 bg-red-500/20 text-red-400 border border-red-500/40 rounded hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
							>
								Clear All Data
							</button>
						</div>
						{importProgress && (
							<div className="p-4 bg-black/40 border border-gold/20 rounded">
								<p className="text-off-white text-sm">{importProgress}</p>
							</div>
						)}
					</div>
				</section>

				{/* Lists Section */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
					{/* Categories List */}
					<section className="bg-marble-black/80 border border-gold/30 rounded-xl p-6">
						<h2 className="font-cinzel text-xl text-gold mb-4">All Categories ({filteredCategories.length})</h2>
						<div className="mb-3">
							<label className="block text-sm text-muted-gray mb-1">Filter by category/subcategory</label>
							<select
								value={listFilterCategoryId}
								onChange={e => setListFilterCategoryId(e.target.value)}
								className="w-full px-3 py-2 rounded bg-black/40 border border-gold/20 focus:outline-none text-off-white"
							>
								<option value="">All categories</option>
								{pathOptions.map(o => (
									<option key={o.id} value={o.id}>{o.label}</option>
								))}
							</select>
							{listFilterCategoryId && (
								<p className="text-xs text-muted-gray mt-1">Showing selected category + subcategories</p>
							)}
						</div>
						<div className="space-y-2 max-h-96 overflow-y-auto">
							{filteredCategories.map(cat => (
								<div key={cat.id} className="flex items-center justify-between p-3 bg-black/40 rounded border border-gold/10 hover:border-gold/30 transition-colors">
									<div className="flex-1">
										<p className="text-off-white font-medium">{getName(cat)}</p>
										{cat.parentId && (
											<p className="text-xs text-muted-gray">Parent: {pathOptions.find(o => o.id === cat.parentId)?.label || 'Unknown'}</p>
										)}
									</div>
									<div className="flex gap-2">
										<button onClick={() => handleEditCategory(cat)} className="px-3 py-1 bg-gold/20 text-gold rounded hover:bg-gold/30 text-sm">
											<i className="fas fa-edit"></i>
										</button>
										<button onClick={() => handleDeleteCategory(cat.id)} className="px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 text-sm">
											<i className="fas fa-trash"></i>
										</button>
									</div>
								</div>
							))}
						</div>
					</section>

					{/* Products List */}
					<section className="bg-marble-black/80 border border-gold/30 rounded-xl p-6">
						<h2 className="font-cinzel text-xl text-gold mb-4">All Products ({searchedProducts.length})</h2>
						<div className="mb-3">
							<label className="block text-sm text-muted-gray mb-1">Filter dishes by category/subcategory</label>
							<select
								value={listFilterCategoryId}
								onChange={e => setListFilterCategoryId(e.target.value)}
								className="w-full px-3 py-2 rounded bg-black/40 border border-gold/20 focus:outline-none text-off-white"
							>
								<option value="">All products</option>
								{pathOptions.map(o => (
									<option key={o.id} value={o.id}>{o.label}</option>
								))}
							</select>
							{listFilterCategoryId && (
								<p className="text-xs text-muted-gray mt-1">Showing dishes in selected category subtree</p>
							)}
						</div>
						<div className="mb-3">
							<label className="block text-sm text-muted-gray mb-1">Search product by name</label>
							<input
								value={listProductSearch}
								onChange={(e) => setListProductSearch(e.target.value)}
								placeholder="Type a product name…"
								className="w-full px-3 py-2 rounded bg-black/40 border border-gold/20 focus:outline-none text-off-white"
							/>
							{listProductSearch && (
								<p className="text-xs text-muted-gray mt-1">Filtering by name in EN/RO/AR</p>
							)}
						</div>
						<div className="space-y-2 max-h-96 overflow-y-auto">
							{searchedProducts.map(prod => (
								<div key={prod.id} className="flex items-center justify-between p-3 bg-black/40 rounded border border-gold/10 hover:border-gold/30 transition-colors">
									<div className="flex-1">
										<p className="text-off-white font-medium">{getName(prod)}</p>
										<p className="text-xs text-gold">{prod.price} LEI</p>
										{prod.categoryId && (
											<p className="text-xs text-muted-gray">Category: {pathOptions.find(o => o.id === prod.categoryId)?.label || 'Unknown'}</p>
										)}
									</div>
									<div className="flex gap-2">
										<button onClick={() => handleEditProduct(prod)} className="px-3 py-1 bg-gold/20 text-gold rounded hover:bg-gold/30 text-sm">
											<i className="fas fa-edit"></i>
										</button>
										<button onClick={() => handleDeleteProduct(prod.id)} className="px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 text-sm">
											<i className="fas fa-trash"></i>
										</button>
									</div>
								</div>
							))}
						</div>
					</section>
				</div>

				{/* Footer Settings Section */}
				<section className="bg-marble-black/80 border border-gold/30 rounded-xl p-6">
					<h2 className="font-cinzel text-xl text-gold mb-4">Footer Settings</h2>
					{footerSettings && (
						<form onSubmit={handleSaveFooter} className="space-y-6">
							{/* Contact Information */}
							<div className="space-y-4">
								<h3 className="font-cinzel text-lg text-gold/80">Contact Information</h3>
								<div>
									<label className="block text-sm text-muted-gray mb-1">Address</label>
									<input 
										value={footerAddress} 
										onChange={e => setFooterAddress(e.target.value)} 
										placeholder="Restaurant address" 
										className="w-full px-3 py-2 rounded bg-black/40 border border-gold/20 focus:outline-none text-off-white" 
										required 
									/>
								</div>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label className="block text-sm text-muted-gray mb-1">Phone</label>
										<input 
											value={footerPhone} 
											onChange={e => setFooterPhone(e.target.value)} 
											placeholder="+40 XXX XXX XXX" 
											className="w-full px-3 py-2 rounded bg-black/40 border border-gold/20 focus:outline-none text-off-white" 
											required 
										/>
									</div>
									<div>
										<label className="block text-sm text-muted-gray mb-1">Email</label>
										<input 
											type="email" 
											value={footerEmail} 
											onChange={e => setFooterEmail(e.target.value)} 
											placeholder="contact@restaurant.com" 
											className="w-full px-3 py-2 rounded bg-black/40 border border-gold/20 focus:outline-none text-off-white" 
										/>
									</div>
								</div>
							</div>

							{/* Opening Hours */}
							<div className="space-y-4">
								<h3 className="font-cinzel text-lg text-gold/80">Opening Hours</h3>
								<div>
									<label className="block text-sm text-muted-gray mb-1">Monday - Thursday</label>
									<input 
										value={hoursMonThu} 
										onChange={e => setHoursMonThu(e.target.value)} 
										placeholder="11:00–22:00" 
										className="w-full px-3 py-2 rounded bg-black/40 border border-gold/20 focus:outline-none text-off-white" 
										required 
									/>
								</div>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label className="block text-sm text-muted-gray mb-1">Friday - Saturday</label>
										<input 
											value={hoursFriSat} 
											onChange={e => setHoursFriSat(e.target.value)} 
											placeholder="11:00–23:00" 
											className="w-full px-3 py-2 rounded bg-black/40 border border-gold/20 focus:outline-none text-off-white" 
											required 
										/>
									</div>
									<div>
										<label className="block text-sm text-muted-gray mb-1">Sunday</label>
										<input 
											value={hoursSun} 
											onChange={e => setHoursSun(e.target.value)} 
											placeholder="12:00–21:00" 
											className="w-full px-3 py-2 rounded bg-black/40 border border-gold/20 focus:outline-none text-off-white" 
											required 
										/>
									</div>
								</div>
							</div>

							{/* Social Media Links */}
							<div className="space-y-4">
								<h3 className="font-cinzel text-lg text-gold/80">Social Media Links</h3>
								<p className="text-sm text-muted-gray">Leave empty to hide that social media icon</p>
								<div>
									<label className="block text-sm text-muted-gray mb-1">
										<i className="fab fa-instagram mr-2"></i>Instagram URL (optional)
									</label>
									<input 
										value={instagramUrl} 
										onChange={e => setInstagramUrl(e.target.value)} 
										placeholder="https://instagram.com/yourpage" 
										className="w-full px-3 py-2 rounded bg-black/40 border border-gold/20 focus:outline-none text-off-white" 
									/>
								</div>
								<div>
									<label className="block text-sm text-muted-gray mb-1">
										<i className="fab fa-facebook mr-2"></i>Facebook URL (optional)
									</label>
									<input 
										value={facebookUrl} 
										onChange={e => setFacebookUrl(e.target.value)} 
										placeholder="https://facebook.com/yourpage" 
										className="w-full px-3 py-2 rounded bg-black/40 border border-gold/20 focus:outline-none text-off-white" 
									/>
								</div>
								<div>
									<label className="block text-sm text-muted-gray mb-1">
										<i className="fab fa-tiktok mr-2"></i>TikTok URL (optional)
									</label>
									<input 
										value={tiktokUrl} 
										onChange={e => setTiktokUrl(e.target.value)} 
										placeholder="https://tiktok.com/@yourpage" 
										className="w-full px-3 py-2 rounded bg-black/40 border border-gold/20 focus:outline-none text-off-white" 
									/>
								</div>
							</div>

							<button type="submit" className="w-full px-6 py-3 bg-gold text-black rounded hover:bg-deep-gold font-semibold">
								Save Footer Settings
							</button>
						</form>
					)}
				</section>

				{/* App UI Settings Section */}
				<section className="bg-marble-black/80 border border-gold/30 rounded-xl p-6">
					<h2 className="font-cinzel text-xl text-gold mb-4">App UI Settings</h2>
					<form onSubmit={handleSaveAppSettings} className="space-y-4">
						<div className="bg-black/40 border border-gold/20 rounded-lg p-4">
							<p className="text-off-white font-medium">Product placeholder image</p>
							<p className="text-xs text-muted-gray mt-1">Controls whether products without images show a placeholder image everywhere.</p>
							<label className="flex items-center gap-2 mt-3 text-sm text-off-white cursor-pointer">
								<input
									type="checkbox"
									checked={!!showProductPlaceholderImage}
									onChange={(e) => setShowProductPlaceholderImage(e.target.checked)}
								/>
								Show placeholder for missing/broken product images
							</label>
						</div>
						<button type="submit" className="px-6 py-3 bg-gold text-black rounded hover:bg-deep-gold font-semibold">Save App UI Settings</button>
					</form>
				</section>
			</main>
	{ToastComponent}
</div>
);
}
