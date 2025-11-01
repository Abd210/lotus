import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import LoadingOverlay from '../components/LoadingOverlay';
import { getCategoryBundle, setCategoryBundle } from '../utils/cache';
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
	// modal state removed

	React.useEffect(() => {
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
					const an = (a?.name_ro || (a?.name?.ro) || (a?.name?.en) || a?.name || '').toString().toLowerCase();
					const bn = (b?.name_ro || (b?.name?.ro) || (b?.name?.en) || b?.name || '').toString().toLowerCase();
					return an.localeCompare(bn);
				});
				prodsData.sort((a,b)=>{
					const an = (a?.name_ro || (a?.name?.ro) || (a?.name?.en) || a?.name || '').toString().toLowerCase();
					const bn = (b?.name_ro || (b?.name?.ro) || (b?.name?.en) || b?.name || '').toString().toLowerCase();
					return an.localeCompare(bn);
				});
				
				setCategory(cat);
				setSubcategories(subsData);
				setProducts(prodsData);
				setCategoryBundle(categoryId, { category: cat, subcategories: subsData, products: prodsData });

				// Preload all images immediately
				[...subsData, ...prodsData].forEach(item => {
					if (item.imageUrl) {
						const img = new Image();
						img.src = item.imageUrl;
					}
				});
			} catch (e) {
				console.error(e);
			} finally {
				setLoading(false);
			}
		})();
	}, [categoryId]);

	const getName = React.useCallback((item) => (item?.name && (item.name[lang] || item.name.en || item.name.ro)) || item?.name || '', [lang]);
	const getDesc = React.useCallback((item) => (item?.description && (item.description[lang] || item.description.en || item.description.ro)) || item?.description || '', [lang]);

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

				{/* Subcategories Section */}
				{subcategories.length > 0 && (
					<div className="mb-12">
						<h3 className="font-cinzel text-2xl text-gold mb-6 text-center">{t('subcategories')}</h3>
						<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto mb-8">
							{subcategories.map(subcat => (
								<div 
									key={subcat.id} 
									onClick={() => navigate(`/category/${subcat.id}`)}
									className="category-card-container group cursor-pointer"
								>
									<div className="relative overflow-hidden rounded-xl border border-gold/30 gold-glow transition-all duration-250">
										<div className="h-40 overflow-hidden bg-marble-black/50">
											<img 
												className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-250" 
												src={subcat.imageUrl || 'https://images.unsplash.com/photo-1541542684-4a6e4f9a82b4?q=80&w=1200&auto=format&fit=crop'} 
												alt={getName(subcat)}
												loading="eager"
												decoding="async"
											/>
										</div>
										<div className="absolute inset-0 category-card"></div>
										<div className="absolute bottom-0 left-0 right-0 p-3">
											<h3 className="font-cinzel text-base font-semibold text-off-white">{getName(subcat)}</h3>
										</div>
									</div>
								</div>
							))}
						</div>
						<div className="diagonal-line max-w-4xl mx-auto my-8"></div>
					</div>
				)}

				{/* Products Section */}
				{products.length > 0 && (
					<div>
						<h3 className="font-cinzel text-2xl text-gold mb-6 text-center">{t('products')}</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
					{products.map(product => (
						<div 
							key={product.id} 
							onClick={() => navigate(`/product/${product.id}`)}
							className="bg-marble-black/80 border border-gold/30 rounded-xl overflow-hidden hover:border-gold hover:shadow-xl hover:shadow-gold/10 transition-all cursor-pointer group"
						>
							{product.imageUrl && (
								<div className="h-56 overflow-hidden relative bg-marble-black/50">
									<img 
										src={product.imageUrl} 
										alt={getName(product)} 
										className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
										loading="eager"
										decoding="async"
									/>
									<div className="absolute inset-0 bg-gradient-to-t from-marble-black via-transparent to-transparent opacity-60"></div>
								</div>
							)}
							<div className="p-5">
								<h3 className="font-cinzel text-xl text-gold mb-2 group-hover:text-deep-gold transition-colors">{getName(product)}</h3>
								{product.description && (
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
				{!loading && subcategories.length === 0 && products.length === 0 && (
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

