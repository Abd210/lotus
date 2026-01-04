import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import LoadingOverlay from '../components/LoadingOverlay';
import { getAppSettingsCache, getCategoryBundle, setAppSettingsCache, setCategoryBundle } from '../utils/cache';
import { useI18n } from '../i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';
// Modal removed for performance; product opens in its own route

export default function CategoryProducts() {
	const { categoryId } = useParams();
	const navigate = useNavigate();
	const { t, lang } = useI18n();
	const [category, setCategory] = React.useState(null);
	const [subcategories, setSubcategories] = React.useState([]);
	const [products, setProducts] = React.useState([]);
	const [loading, setLoading] = React.useState(false);
	const [inheritedMenuPage, setInheritedMenuPage] = React.useState(null);
	const [showProductPlaceholderImage, setShowProductPlaceholderImage] = React.useState(true);
	// modal state removed

	React.useEffect(() => {
		const cached = getAppSettingsCache();
		if (cached && typeof cached.showProductPlaceholderImage === 'boolean') {
			setShowProductPlaceholderImage(cached.showProductPlaceholderImage);
		}
		(async () => {
			try {
				const snap = await getDoc(doc(db, 'settings', 'app'));
				const data = snap.exists() ? snap.data() : { showProductPlaceholderImage: true };
				setAppSettingsCache(data);
				setShowProductPlaceholderImage(data.showProductPlaceholderImage !== false);
			} catch (e) {
				// default: show placeholder
				setShowProductPlaceholderImage(true);
			}
		})();
	}, []);

	const isPlaceholderUrl = React.useCallback((url) => {
		if (!url) return false;
		const s = String(url).toLowerCase();
		return s.includes('/images/menu/placeholder.svg') || s.endsWith('placeholder.svg');
	}, []);

	React.useEffect(() => {
		setInheritedMenuPage(null);
		const cached = getCategoryBundle(categoryId);
		if (cached) {
			setCategory(cached.category || null);
			setSubcategories(cached.subcategories || []);
			setProducts(cached.products || []);
		} else {
			setLoading(true);
		}
		(async () => {
			try {
				// Get all data in parallel for faster loading
				const [catDoc, subsSnap, productsSnap] = await Promise.all([
					getDoc(doc(db, 'categories', categoryId)),
					getDocs(query(collection(db, 'categories'), where('parentId', '==', categoryId))),
					getDocs(query(collection(db, 'products'), where('categoryId', '==', categoryId)))
				]);

				const cat = catDoc.exists() ? { id: catDoc.id, ...catDoc.data() } : null;
				const subsData = subsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
				const prodsData = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
				// sort client-side by name_ro with fallbacks
				subsData.sort((a,b)=>{
					const an = (a?.name_ro || (a?.name?.ro) || (a?.name?.en) || (a?.name?.ar) || a?.name || '').toString().toLowerCase();
					const bn = (b?.name_ro || (b?.name?.ro) || (b?.name?.en) || (b?.name?.ar) || b?.name || '').toString().toLowerCase();
					return an.localeCompare(bn);
				});
				prodsData.sort((a,b)=>{
					const an = (a?.name_ro || (a?.name?.ro) || (a?.name?.en) || (a?.name?.ar) || a?.name || '').toString().toLowerCase();
					const bn = (b?.name_ro || (b?.name?.ro) || (b?.name?.en) || (b?.name?.ar) || b?.name || '').toString().toLowerCase();
					return an.localeCompare(bn);
				});
				
				setCategory(cat);
				setSubcategories(subsData);
				setProducts(prodsData);
				setCategoryBundle(categoryId, { category: cat, subcategories: subsData, products: prodsData });

				// Inherit menu page image/mode from parent (optional)
				const allowedModes = new Set(['products_only', 'image_and_products', 'image_only']);
				const hasExplicitMode = allowedModes.has((cat?.menuPageMode || '').toString());
				const hasExplicitImages = Array.isArray(cat?.menuPageImages) && cat.menuPageImages.filter(Boolean).length > 0;
				const shouldCheckParent = !!(cat && cat.parentId && !hasExplicitMode && !hasExplicitImages);
				if (shouldCheckParent) {
					const parentDoc = await getDoc(doc(db, 'categories', cat.parentId));
					if (parentDoc.exists()) {
						const parent = { id: parentDoc.id, ...parentDoc.data() };
						const parentAllows = !!parent?.menuPageInheritToChildren;
						const parentImages = Array.isArray(parent?.menuPageImages) ? parent.menuPageImages.filter(Boolean) : [];
						if (parentAllows && parentImages.length > 0) {
							const rawChildMode = (parent?.menuPageChildrenMode || '').toString();
							const inheritedMode = allowedModes.has(rawChildMode)
								? rawChildMode
								: (allowedModes.has((parent?.menuPageMode || '').toString()) ? parent.menuPageMode : 'image_only');
							setInheritedMenuPage({ images: parentImages, mode: inheritedMode });
						}
					}
				}
			} catch (e) {
				console.error(e);
			} finally {
				setLoading(false);
			}
		})();
	}, [categoryId]);

	const getName = React.useCallback((item) => {
		const n = item?.name;
		if (!n) return '';
		if (typeof n === 'string') return n;
		if (typeof n === 'object') return (n[lang] || n.en || n.ro || n.ar || '') || '';
		return '';
	}, [lang]);
	const getDesc = React.useCallback((item) => {
		const d = item?.description;
		if (!d) return '';
		if (typeof d === 'string') return d;
		if (typeof d === 'object') return (d[lang] || d.en || d.ro || d.ar || '') || '';
		return '';
	}, [lang]);

	const isDrinksCategory = React.useMemo(() => {
		if (!category) return false;
		const toText = (v) => (v == null ? '' : String(v));
		const norm = (v) => toText(v).trim().toLowerCase();
		const names = [];
		if (typeof category.name === 'string') names.push(category.name);
		if (category.name && typeof category.name === 'object') names.push(category.name.en, category.name.ro, category.name.ar);
		names.push(category.name_ro);
		const s = norm(names.filter(Boolean).join(' '));
		return s.includes('drink') || s.includes('beverage') || s.includes('مشر');
	}, [category]);

	const isFoodCategory = React.useMemo(() => {
		if (!category) return false;
		const toText = (v) => (v == null ? '' : String(v));
		const norm = (v) => toText(v).trim().toLowerCase();
		const names = [];
		if (typeof category.name === 'string') names.push(category.name);
		if (category.name && typeof category.name === 'object') names.push(category.name.en, category.name.ro, category.name.ar);
		names.push(category.name_ro);
		const s = norm(names.filter(Boolean).join(' '));
		return s.includes('food') || s.includes('mancare') || s.includes('mâncare') || s.includes('طعام');
	}, [category]);

	const isAppetizersCategory = React.useMemo(() => {
		if (!category) return false;
		const toText = (v) => (v == null ? '' : String(v));
		const norm = (v) => toText(v).trim().toLowerCase();
		const names = [];
		if (typeof category.name === 'string') names.push(category.name);
		if (category.name && typeof category.name === 'object') names.push(category.name.en, category.name.ro, category.name.ar);
		names.push(category.name_ro);
		const s = norm(names.filter(Boolean).join(' '));
		return s.includes('appet');
	}, [category]);

	const getDrinkSubcategoryLocalImage = React.useCallback((subcat) => {
		if (!subcat) return null;
		const toText = (v) => (v == null ? '' : String(v));
		const norm = (v) => toText(v).trim().toLowerCase();
		const names = [];
		if (typeof subcat.name === 'string') names.push(subcat.name);
		if (subcat.name && typeof subcat.name === 'object') names.push(subcat.name.en, subcat.name.ro, subcat.name.ar);
		names.push(subcat.name_ro);
		const s = norm(names.filter(Boolean).join(' '));

		if (s.includes('cocktail') || s.includes('كوكت')) return '/images/menu/drinks/cocktails.webp';
		if (s.includes('mocktail') || s.includes('موكت')) return '/images/menu/drinks/mocktails.webp';
		if (s.includes('coffee') || s.includes('cafea') || s.includes('قهوة')) return '/images/menu/drinks/coffee-and-more.webp';
		if (s.includes('freak') || s.includes('frappe') || s.includes('frapp') || s.includes('shake')) return '/images/menu/drinks/freak-shakes-and-frappe.webp';
		if (s.includes('lemon') || s.includes('fresh') || s.includes('lemonade') || s.includes('freshes')) return '/images/menu/drinks/lemonade-and-fresh-juices.webp';
		if (s.includes('soft drink') || s === 'soft drinks' || s.includes('gaz') || s.includes('suc')) return '/images/menu/drinks/soft-drinks.webp';
		return null;
	}, []);

	const getFoodSubcategoryLocalImage = React.useCallback((subcat) => {
		if (!subcat) return null;
		const toText = (v) => (v == null ? '' : String(v));
		const norm = (v) => toText(v).trim().toLowerCase();
		const names = [];
		if (typeof subcat.name === 'string') names.push(subcat.name);
		if (subcat.name && typeof subcat.name === 'object') names.push(subcat.name.en, subcat.name.ro, subcat.name.ar);
		names.push(subcat.name_ro);
		const s = norm(names.filter(Boolean).join(' '));

		if (s.includes('appet')) return '/images/menu/food/appetizers.webp';
		if (s.includes('burger')) return '/images/menu/food/burgers.webp';
		if (s.includes('breakfast') || s.includes('mic dejun') || s.includes('dejun')) return '/images/menu/food/breakfast.webp';
		if (s.includes('soup') || s.includes('supa') || s.includes('supă')) return '/images/menu/food/soups.webp';
		if (s.includes('salad') || s.includes('salate')) return '/images/menu/food/salads.webp';
		if (s.includes('pasta')) return '/images/menu/food/pasta.webp';
		if (s.includes('side') || s.includes('garnit')) return '/images/menu/food/sides.webp';
		if (s.includes('grill') || s.includes('gratar') || s.includes('grătar')) return '/images/menu/food/grill.webp';
		if (s.includes('international')) return '/images/menu/food/international-dishes.webp';
		return null;
	}, []);

	const getAppetizersSubcategoryLocalImage = React.useCallback((subcat) => {
		if (!subcat) return null;
		const toText = (v) => (v == null ? '' : String(v));
		const norm = (v) => toText(v).trim().toLowerCase();
		const names = [];
		if (typeof subcat.name === 'string') names.push(subcat.name);
		if (subcat.name && typeof subcat.name === 'object') names.push(subcat.name.en, subcat.name.ro, subcat.name.ar);
		names.push(subcat.name_ro);
		const s = norm(names.filter(Boolean).join(' '));

		if (s.includes('hot')) return '/images/menu/food/hot-appetizers.webp';
		if (s.includes('cold')) return '/images/menu/food/cold-appetizers.webp';
		return null;
	}, []);

	const getDrinksMenuPageImage = React.useCallback((cat) => {
		// For drink leaf categories, show a full-screen menu-page image instead of product cards.
		if (!cat) return null;
		const toText = (v) => (v == null ? '' : String(v));
		const norm = (v) => toText(v).trim().toLowerCase();
		const names = [];
		if (typeof cat.name === 'string') names.push(cat.name);
		if (cat.name && typeof cat.name === 'object') names.push(cat.name.en, cat.name.ro, cat.name.ar);
		names.push(cat.name_ro);
		const s = norm(names.filter(Boolean).join(' '));

		// Be specific so we don't match the top-level "Drinks" category.
		if (s.includes('mocktail')) return ['/images/menu/drinks-pages/mocktails.jpg'];
		if (s.includes('cocktail')) return ['/images/menu/drinks-pages/cocktails.jpg'];
		if (s.includes('soft drink') || s === 'soft drinks') return ['/images/menu/drinks-pages/soft-drinks.jpg'];
		if (s.includes('coffee')) {
			// Coffee & More has 2 pages (stacked). Add the 2nd file in public/images/menu/drinks-pages/.
			return ['/images/menu/drinks-pages/coffee-and-more.jpg', '/images/menu/drinks-pages/coffee-and-more-2.jpg'];
		}
		if (s.includes('freak') || s.includes('frappe') || s.includes('frapp') || s.includes('shake')) return ['/images/menu/drinks-pages/freak-shakes-and-frappe.jpg'];
		if (s.includes('lemon') || s.includes('fresh') || s.includes('lemonade') || s.includes('freshes')) return ['/images/menu/drinks-pages/lemonades-and-fresh-juices.jpg'];
		return null;
	}, []);

	const drinksMenuPageImages = React.useMemo(() => {
		// This is intentionally NOT gated by isDrinksCategory.
		// Leaf drink categories like "COCKTAILS" or "MOCKTAILS" should activate this view.
		return getDrinksMenuPageImage(category);
	}, [category, getDrinksMenuPageImage]);

	const menuPageImages = React.useMemo(() => {
		const configured = Array.isArray(category?.menuPageImages) ? category.menuPageImages.filter(Boolean) : [];
		if (configured.length > 0) return configured;
		const inherited = Array.isArray(inheritedMenuPage?.images) ? inheritedMenuPage.images.filter(Boolean) : [];
		if (inherited.length > 0) return inherited;
		return Array.isArray(drinksMenuPageImages) ? drinksMenuPageImages : null;
	}, [category, drinksMenuPageImages, inheritedMenuPage]);

	const menuPageMode = React.useMemo(() => {
		// products_only: hide images, show products/subcategories
		// image_and_products: show both
		// image_only: show only images
		const raw = (category?.menuPageMode || '').toString().trim();
		if (raw === 'products_only' || raw === 'image_and_products' || raw === 'image_only') return raw;
		const inheritedRaw = (inheritedMenuPage?.mode || '').toString().trim();
		if (inheritedRaw === 'products_only' || inheritedRaw === 'image_and_products' || inheritedRaw === 'image_only') return inheritedRaw;
		// Safe default: if images exist but mode not set, don't hide products.
		return (Array.isArray(menuPageImages) && menuPageImages.length > 0) ? 'image_and_products' : 'products_only';
	}, [category, inheritedMenuPage, menuPageImages]);

	const showMenuImages = React.useMemo(() => {
		return Array.isArray(menuPageImages) && menuPageImages.length > 0 && menuPageMode !== 'products_only';
	}, [menuPageImages, menuPageMode]);

	const showCategoryContent = React.useMemo(() => {
		return menuPageMode !== 'image_only';
	}, [menuPageMode]);

	const [fullscreenSrc, setFullscreenSrc] = React.useState(null);

	React.useEffect(() => {
		if (!fullscreenSrc) return;
		const onKeyDown = (e) => {
			if (e.key === 'Escape') setFullscreenSrc(null);
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [fullscreenSrc]);


	return (
		<div className="min-h-screen marble-bg marble-overlay text-off-white">
			<header className="sticky top-0 z-30 bg-marble-black/90 backdrop-blur-md border-b border-gold/20">
				<div className="px-4 py-1">
		<div className="flex items-center justify-between">
			<div className="w-20 flex items-center">
				<button onClick={() => navigate('/')} className="text-gold active:opacity-70"><i className="fas fa-arrow-left text-2xl"></i></button>
			</div>
			<div className="flex-1 flex items-center justify-center">
				<img src="/lotus-logo.png" alt="Lotus" className="h-24 w-auto cursor-pointer active:opacity-70" onClick={() => navigate('/')} />
			</div>
			<div className="w-20 flex items-center justify-end gap-3">
				<LanguageSwitcher />
			</div>
		</div>
				</div>
				<div className="gold-line mx-4"></div>
			</header>

			<section className="py-8 px-4">
				<div className="text-center mb-8">
					<h2 className="font-cinzel text-3xl text-gold mb-2">{getName(category) || 'Category'}</h2>
					<div className="gold-line max-w-32 mx-auto"></div>
				</div>

				{showMenuImages ? (
					<div className="max-w-3xl mx-auto space-y-4">
						{menuPageImages.map((src, idx) => (
							<img
								key={`${src}-${idx}`}
								src={src}
								alt={getName(category) || 'Menu'}
								className="w-full h-auto rounded-xl border border-gold/20 bg-black/40 cursor-zoom-in"
								loading={idx === 0 ? 'eager' : 'lazy'}
								fetchPriority={idx === 0 ? 'high' : 'auto'}
								decoding="async"
								onClick={() => setFullscreenSrc(src)}
								onError={(e) => {
									if (e.currentTarget?.dataset?.fallbackApplied) return;
									e.currentTarget.dataset.fallbackApplied = '1';
									e.currentTarget.src = '/images/menu/placeholder.svg';
								}}
							/>
						))}
					</div>
				) : null}

				{fullscreenSrc ? (
					<div
						className="fixed inset-0 z-50 bg-marble-black/95 flex items-center justify-center"
						onClick={() => setFullscreenSrc(null)}
						onMouseDown={() => setFullscreenSrc(null)}
						onTouchStart={() => setFullscreenSrc(null)}
						role="dialog"
						aria-modal="true"
					>
						<button
							type="button"
							onClick={() => setFullscreenSrc(null)}
							className="absolute top-4 right-4 z-10 px-3 py-2 bg-black/40 border border-gold/30 text-gold rounded-lg active:opacity-80"
							aria-label="Close"
						>
							<i className="fas fa-times"></i>
						</button>
						<img
							src={fullscreenSrc}
							alt={getName(category) || 'Menu'}
							className="w-full h-full object-contain"
							decoding="async"
						/>
					</div>
				) : null}

				{/* Subcategories Section */}
				{showCategoryContent && subcategories.length > 0 && (
					<div className="mb-12">
						<h3 className="font-cinzel text-2xl text-gold mb-6 text-center">{t('subcategories')}</h3>
						<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto mb-8">
							{subcategories.map(subcat => {
								const local = isDrinksCategory
									? getDrinkSubcategoryLocalImage(subcat)
									: (isFoodCategory
										? getFoodSubcategoryLocalImage(subcat)
										: (isAppetizersCategory ? getAppetizersSubcategoryLocalImage(subcat) : null));
								const src = local || subcat.imageUrl || 'https://images.unsplash.com/photo-1541542684-4a6e4f9a82b4?q=80&w=1200&auto=format&fit=crop';
								const imgLoading = local ? 'eager' : 'lazy';
								const imgFetchPriority = local ? 'high' : 'auto';
								return (
									<div 
										key={subcat.id} 
										onClick={() => navigate(`/category/${subcat.id}`)}
										className="category-card-container group cursor-pointer"
									>
										<div className="relative overflow-hidden rounded-xl border border-gold/30 gold-glow transition-all duration-250">
											<div className="h-40 overflow-hidden bg-marble-black/50">
												<img 
													className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-250" 
													src={src}
													alt={getName(subcat)}
													loading={imgLoading}
													fetchPriority={imgFetchPriority}
													onError={(e) => {
														// If Firebase imageUrl is broken/missing, fall back to a local placeholder.
														if (e.currentTarget?.dataset?.fallbackApplied) return;
														e.currentTarget.dataset.fallbackApplied = '1';
														e.currentTarget.src = '/images/menu/placeholder.svg';
												}}
													decoding="async"
												/>
											</div>
											<div className="absolute inset-0 category-card"></div>
											<div className="absolute bottom-0 left-0 right-0 p-3">
												<h3 className="font-cinzel text-base font-semibold text-off-white">{getName(subcat)}</h3>
											</div>
										</div>
									</div>
								);
							})}
						</div>
						<div className="diagonal-line my-8"></div>
					</div>
				)}

				{/* Products Section */}
				{showCategoryContent && products.length > 0 && (
					<div>
						<h3 className="font-cinzel text-2xl text-gold mb-6 text-center">{t('products')}</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
					{products.map(product => (
						<div 
							key={product.id} 
							onClick={() => navigate(`/product/${product.id}`)}
							className="bg-marble-black/80 border border-gold/30 rounded-xl overflow-hidden hover:border-gold hover:shadow-xl hover:shadow-gold/10 transition-all cursor-pointer group"
						>
							{(() => {
								const rawUrl = product?.imageUrl || '';
								const hasRealImage = !!rawUrl && !isPlaceholderUrl(rawUrl);
								const shouldShowImageBlock = hasRealImage || showProductPlaceholderImage;
								if (!shouldShowImageBlock) return null;
								const src = hasRealImage ? rawUrl : '/images/menu/placeholder.svg';
								return (
									<div className="product-image-wrap h-56 overflow-hidden relative bg-marble-black/50">
										<img 
											src={src}
											alt={getName(product)} 
											className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
											loading="lazy"
											decoding="async"
											onError={(e) => {
												if (showProductPlaceholderImage) {
													if (e.currentTarget?.dataset?.fallbackApplied) return;
													e.currentTarget.dataset.fallbackApplied = '1';
													e.currentTarget.src = '/images/menu/placeholder.svg';
													return;
												}
												const wrap = e.currentTarget?.closest?.('.product-image-wrap');
												if (wrap) wrap.style.display = 'none';
											}}
									/>
										<div className="absolute inset-0 bg-gradient-to-t from-marble-black via-transparent to-transparent opacity-60"></div>
									</div>
								);
							})()}
							<div className="p-5">
								<h3 className="font-cinzel text-xl text-gold mb-2 group-hover:text-deep-gold transition-colors">{getName(product)}</h3>
								{getDesc(product) && (
									<p className="text-off-white/80 text-sm mb-3 line-clamp-2">
										{getDesc(product)}
									</p>
								)}
								<div className="flex items-center justify-between">
									<p className="text-gold font-semibold text-xl">{product.price} LEI</p>
									<span className="text-gold text-sm opacity-0 group-hover:opacity-100 transition-opacity">
										{t('viewDetails')} <i className="fas fa-arrow-right ml-1"></i>
									</span>
								</div>
							</div>
						</div>
					))}
					</div>
					</div>
				)}

				{/* Empty State */}
				{!loading && showCategoryContent && subcategories.length === 0 && products.length === 0 && (
					<div className="text-center py-12">
						<p className="text-muted-gray text-lg">{t('emptyCategoryTitle')}</p>
						<p className="text-muted-gray text-sm mt-2">{t('emptyCategoryDesc')}</p>
					</div>
				)}
			</section>

		{/* Modal removed */}
		{loading && subcategories.length === 0 && products.length === 0 ? <LoadingOverlay text="Loading category…" /> : null}
		</div>
	);
}
