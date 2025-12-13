import React from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import LoadingOverlay from '../components/LoadingOverlay';
import { getCategoriesCache, setCategoriesCache } from '../utils/cache';
import { useI18n } from '../i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

function useCategories() {
	const [categories, setCategories] = React.useState([]);
	const [error, setError] = React.useState(null);
	const [loading, setLoading] = React.useState(false);

	// Serve cached immediately (SWR)
	React.useEffect(() => {
		const cached = getCategoriesCache();
		if (cached) setCategories(cached);
		setLoading(!cached);
		(async () => {
			try {
				const snap = await getDocs(collection(db, 'categories'));
				const list = snap.docs.map(d=>({ id: d.id, ...d.data() }));
				list.sort((a,b)=>{
					const an = (a?.name_ro || (a?.name?.ro) || (a?.name?.en) || a?.name || '').toString().toLowerCase();
					const bn = (b?.name_ro || (b?.name?.ro) || (b?.name?.en) || b?.name || '').toString().toLowerCase();
					return an.localeCompare(bn);
				});
				setCategories(list);
				setCategoriesCache(list);
			} catch (e) {
				console.error(e);
				setError(e);
			} finally {
				setLoading(false);
			}
		})();
	}, []);
	return { categories, error, loading };
}

function useFooterSettings() {
	const [settings, setSettings] = React.useState({
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
	React.useEffect(() => {
		(async () => {
			try {
				const docSnap = await getDoc(doc(db, 'settings', 'footer'));
				if (docSnap.exists()) {
					setSettings(docSnap.data());
				}
			} catch (e) {
				console.error('Error loading footer settings:', e);
			}
		})();
	}, []);
	return settings;
}

export default function Menu() {
	const navigate = useNavigate();
	const { categories, error, loading } = useCategories();
	const { t, lang } = useI18n();
	const footerSettings = useFooterSettings();

	const getName = React.useCallback((item) => {
		return (item?.name && (item.name[lang] || item.name.en || item.name.ro)) || item?.name || '';
	}, [lang]);
	const topLevel = categories.filter(c => !c.parentId);
	const childrenByParent = React.useMemo(() => {
		const map = new Map();
		categories.forEach(c => {
			if (!c.parentId) return;
			if (!map.has(c.parentId)) map.set(c.parentId, []);
			map.get(c.parentId).push(c);
		});
		return map;
	}, [categories]);

	const [drawerOpen, setDrawerOpen] = React.useState(false);
	const toggleDrawer = () => setDrawerOpen(!drawerOpen);

	// Preload all category images
	React.useEffect(() => {
		topLevel.forEach(cat => {
			if (cat.imageUrl) {
				const img = new Image();
				img.src = cat.imageUrl;
			}
		});
	}, [topLevel]);

	return (
		<div className="marble-overlay min-h-screen">
			{loading && categories.length === 0 ? <LoadingOverlay text="Loading menu…" /> : null}
			{error ? (
				<div className="p-4 text-center text-red-400">Unable to load menu. Check Firestore rules.</div>
			) : null}
			{/* Drawer Overlay */}
			<div className={`fixed inset-0 drawer-overlay z-40 ${drawerOpen ? '' : 'hidden'}`} onClick={toggleDrawer}></div>

			{/* Slide-out Drawer */}
			<div className={`fixed top-0 left-0 h-full w-80 drawer z-50 transform transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
				<div className="p-6 border-b border-gold/30">
					<div className="flex items-center justify-between">
						<h3 className="font-cinzel text-xl text-gold">{t('menuCategories')}</h3>
						<button onClick={toggleDrawer} className="text-gold active:opacity-70"><i className="fas fa-times text-xl"></i></button>
					</div>
				</div>
				<div className="p-6 space-y-4 overflow-y-auto h-[calc(100%-4rem)]">
					{topLevel.map(top => (
						<div key={top.id} className="category-group">
							<h4 className="font-cinzel text-lg text-gold mb-3">{getName(top)}</h4>
							<div className="space-y-2 ml-4">
								{(childrenByParent.get(top.id) || []).map(sub => (
									<button key={sub.id} onClick={() => navigate(`/category/${sub.id}`)} className="block text-off-white active:text-gold text-left w-full">{getName(sub)}</button>
								))}
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Sticky Header */}
			<header className="sticky top-0 z-30 bg-marble-black/90 backdrop-blur-md border-b border-gold/20">
				<div className="px-4 py-1">
		<div className="flex items-center justify-between">
		<div className="w-20 flex items-center">
			<button onClick={toggleDrawer} className="text-gold active:opacity-70"><i className="fas fa-bars text-2xl"></i></button>
		</div>
		<div className="flex-1 flex items-center justify-center">
			<img src="/lotus-logo.png" alt="Lotus" className="h-24 w-auto cursor-pointer active:opacity-70" onClick={() => navigate('/')} decoding="async" fetchPriority="high" loading="eager" />
		</div>
	<div className="w-20 flex items-center justify-end gap-3">
		<LanguageSwitcher />
		{footerSettings.instagramUrl && (
			<a href={footerSettings.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-gold active:opacity-70"><i className="fab fa-instagram text-2xl"></i></a>
		)}
		{footerSettings.facebookUrl && (
			<a href={footerSettings.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-gold active:opacity-70"><i className="fab fa-facebook text-2xl"></i></a>
		)}
		{footerSettings.tiktokUrl && (
			<a href={footerSettings.tiktokUrl} target="_blank" rel="noopener noreferrer" className="text-gold active:opacity-70"><i className="fab fa-tiktok text-2xl"></i></a>
		)}
	</div>
	</div>
				</div>
				<div className="gold-line mx-4"></div>
			</header>

			{/* Intro Strip */}
			<section className="py-8 px-4">
				<div className="text-center">
					<p className="font-cinzel text-lg text-off-white mb-4">{t('tagline')}</p>
					<div className="gold-line max-w-32 mx-auto"></div>
				</div>
			</section>

			{/* Categories Grid */}
			<section className="px-4 pb-12">
				<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
					{topLevel.map(cat => {
						const subs = childrenByParent.get(cat.id) || [];
						return (
				<div key={cat.id} className="cursor-pointer active:opacity-90" onClick={() => navigate(`/category/${cat.id}`)}>
					<div className="relative overflow-hidden rounded-xl border border-gold/30 shadow-lg">
						<div className="h-48 overflow-hidden bg-marble-black/50">
							<img 
								className="w-full h-full object-cover" 
								src={cat.imageUrl || 'https://images.unsplash.com/photo-1541542684-4a6e4f9a82b4?q=70&w=800&auto=format&fit=crop'} 
								alt={getName(cat)} 
								loading="eager" 
								decoding="async"
							/>
						</div>
						<div className="absolute inset-0 category-card"></div>
						<div className="absolute bottom-0 left-0 right-0 p-4">
							<h3 className="font-cinzel text-lg font-semibold text-off-white mb-2">{getName(cat)}</h3>
							{subs.length > 0 && (
								<div className="flex flex-wrap gap-1">
									{subs.slice(0,2).map(s => (
										<span key={s.id} className="text-xs bg-gold/20 text-gold px-2 py-1 rounded-full">{getName(s)}</span>
									))}
								</div>
							)}
						</div>
					</div>
				</div>
						);
					})}
				</div>
			</section>

		{/* Separator */}
		<div className="diagonal-line"></div>

		{/* Footer (static per design) */}
		<footer className="bg-black pt-12 pb-6">
				<div className="px-4">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
					<div className="contact-section">
						<h3 className="font-cinzel text-xl font-semibold text-gold mb-4">{t('contactUs')}</h3>
						<div className="space-y-3">
							<div className="flex items-start space-x-3"><i className="fas fa-map-marker-alt text-gold mt-1"></i><span className="text-off-white">{footerSettings.address}</span></div>
							<div className="flex items-center space-x-3"><i className="fas fa-phone text-gold"></i><span className="text-off-white">{footerSettings.phone}</span></div>
							<div className="flex items-center space-x-3"><i className="fas fa-envelope text-gold"></i><span className="text-off-white">{footerSettings.email}</span></div>
						</div>
					</div>
					<div className="hours-section">
						<h3 className="font-cinzel text-xl font-semibold text-gold mb-4">{t('openingHours')}</h3>
						<div className="space-y-2">
							<div className="flex justify-between"><span className="text-muted-gray">{t('mondayThu')}</span><span className="text-off-white">{footerSettings.hoursMonThu}</span></div>
							<div className="flex justify-between"><span className="text-muted-gray">{t('friSat')}</span><span className="text-off-white">{footerSettings.hoursFriSat}</span></div>
							<div className="flex justify-between"><span className="text-muted-gray">{t('sunday')}</span><span className="text-off-white">{footerSettings.hoursSun}</span></div>
						</div>
					</div>
						<div className="location-section">
							<h3 className="font-cinzel text-xl font-semibold text-gold mb-4">{t('findUs')}</h3>
							<div className="h-32 bg-marble-black/50 rounded-xl border border-gold/20 mb-4 flex items-center justify-center">
								<iframe title="map" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2849.123!2d26.1234567!3d44.4123456!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDTCsDI0JzQ0LjQiTiAyNsKwMDcnMjQuNCJF!5e0!3m2!1sen!2sro!4v1234567890" className="w-full h-full rounded-xl" style={{ border: 0 }} allowFullScreen loading="lazy"></iframe>
							</div>
							<button className="inline-flex items-center space-x-2 text-gold active:opacity-70"><i className="fas fa-directions"></i><span>{t('getDirections')}</span></button>
						</div>
					</div>
					<div className="gold-line mb-6"></div>
					<div className="flex flex-col space-y-4 md:flex-row md:justify-between md:items-center md:space-y-0">
						<div className="flex items-center space-x-4 text-sm text-muted-gray">
							<span>© 2025 Lotus</span>
							<button className="active:text-gold">{t('privacyPolicy')}</button>
							<span>|</span>
							<button className="active:text-gold">{t('termsOfService')}</button>
						</div>
					<div className="flex space-x-4">
					{footerSettings.instagramUrl && (
						<a href={footerSettings.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-gold active:opacity-70"><i className="fab fa-instagram text-xl"></i></a>
					)}
					{footerSettings.facebookUrl && (
						<a href={footerSettings.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-gold active:opacity-70"><i className="fab fa-facebook text-xl"></i></a>
					)}
					{footerSettings.tiktokUrl && (
						<a href={footerSettings.tiktokUrl} target="_blank" rel="noopener noreferrer" className="text-gold active:opacity-70"><i className="fab fa-tiktok text-xl"></i></a>
					)}
					</div>
					</div>
				</div>
			</footer>
		</div>
	);
}


