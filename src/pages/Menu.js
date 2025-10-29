import React from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

function useCategories() {
	const [categories, setCategories] = React.useState([]);
	const [error, setError] = React.useState(null);
	React.useEffect(() => {
		(async () => {
			try {
				const snap = await getDocs(query(collection(db, 'categories'), orderBy('name')));
				setCategories(snap.docs.map(d=>({ id: d.id, ...d.data() })));
			} catch (e) {
				console.error(e);
				setError(e);
			}
		})();
	}, []);
	return { categories, error };
}

export default function Menu() {
	const navigate = useNavigate();
	const { categories, error } = useCategories();
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

	return (
		<div className="marble-overlay min-h-screen">
			{error ? (
				<div className="p-4 text-center text-red-400">Unable to load menu. Check Firestore rules.</div>
			) : null}
			{/* Drawer Overlay */}
			<div className={`fixed inset-0 drawer-overlay z-40 ${drawerOpen ? '' : 'hidden'}`} onClick={toggleDrawer}></div>

			{/* Slide-out Drawer */}
			<div className={`fixed top-0 left-0 h-full w-80 drawer z-50 transform transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
				<div className="p-6 border-b border-gold/30">
					<div className="flex items-center justify-between">
						<h3 className="font-cinzel text-xl text-gold">Menu Categories</h3>
						<button onClick={toggleDrawer} className="text-gold hover:text-deep-gold"><i className="fas fa-times text-xl"></i></button>
					</div>
				</div>
				<div className="p-6 space-y-4 overflow-y-auto h-[calc(100%-4rem)]">
					{topLevel.map(top => (
						<div key={top.id} className="category-group">
							<h4 className="font-cinzel text-lg text-gold mb-3">{top.name}</h4>
							<div className="space-y-2 ml-4">
								{(childrenByParent.get(top.id) || []).map(sub => (
									<a key={sub.id} href="#" className="block text-off-white hover:text-gold transition-colors">{sub.name}</a>
								))}
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Sticky Header */}
			<header className="sticky top-0 z-30 bg-marble-black/90 backdrop-blur-md border-b border-gold/20">
				<div className="px-4 py-4">
					<div className="flex items-center justify-between">
						<button onClick={toggleDrawer} className="text-gold hover:text-deep-gold transition-colors"><i className="fas fa-bars text-lg"></i></button>
						<div className="flex-1 text-center">
							<h1 className="font-cinzel text-2xl font-semibold text-gold italic">Tress²</h1>
						</div>
						<div className="flex space-x-3">
							<a href="#" className="text-gold hover:text-deep-gold transition-colors"><i className="fab fa-instagram text-lg"></i></a>
							<a href="#" className="text-gold hover:text-deep-gold transition-colors"><i className="fab fa-facebook text-lg"></i></a>
							<a href="#" className="text-gold hover:text-deep-gold transition-colors"><i className="fab fa-tiktok text-lg"></i></a>
						</div>
					</div>
				</div>
				<div className="gold-line mx-4"></div>
			</header>

			{/* Intro Strip */}
			<section className="py-8 px-4">
				<div className="text-center">
					<p className="font-cinzel text-lg text-off-white mb-4">Fine flavors. Modern lounge.</p>
					<div className="gold-line max-w-32 mx-auto"></div>
				</div>
			</section>

			{/* Categories Grid */}
			<section className="px-4 pb-12">
				<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
					{topLevel.map(cat => {
						const subs = childrenByParent.get(cat.id) || [];
						return (
							<div key={cat.id} className="category-card-container group cursor-pointer" onClick={() => navigate(`/category/${cat.id}`)}>
								<div className="relative overflow-hidden rounded-xl border border-gold/30 gold-glow transition-all duration-250">
									<div className="h-48 overflow-hidden">
										<img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-250" src={cat.imageUrl || 'https://images.unsplash.com/photo-1541542684-4a6e4f9a82b4?q=80&w=1200&auto=format&fit=crop'} alt={cat.name} />
									</div>
									<div className="absolute inset-0 category-card"></div>
									<div className="absolute bottom-0 left-0 right-0 p-4">
										<h3 className="font-cinzel text-lg font-semibold text-off-white">{cat.name}</h3>
										<div className="hidden group-hover:flex space-x-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-250">
											{subs.slice(0,2).map(s => (
												<span key={s.id} className="text-xs bg-gold/20 text-gold px-2 py-1 rounded-full">{s.name}</span>
											))}
										</div>
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
							<h3 className="font-cinzel text-xl font-semibold text-gold mb-4">Contact Us</h3>
							<div className="space-y-3">
								<div className="flex items-start space-x-3"><i className="fas fa-map-marker-alt text-gold mt-1"></i><span className="text-off-white">Calea Vitan 174, Bucharest, Romania</span></div>
								<div className="flex items-center space-x-3"><i className="fas fa-phone text-gold"></i><span className="text-off-white">+40 7xx xxx xxx</span></div>
								<div className="flex items-center space-x-3"><i className="fas fa-envelope text-gold"></i><span className="text-off-white">info@tress2.com</span></div>
							</div>
						</div>
						<div className="hours-section">
							<h3 className="font-cinzel text-xl font-semibold text-gold mb-4">Opening Hours</h3>
							<div className="space-y-2">
								<div className="flex justify-between"><span className="text-muted-gray">Monday–Thursday:</span><span className="text-off-white">11:00–22:00</span></div>
								<div className="flex justify-between"><span className="text-muted-gray">Friday–Saturday:</span><span className="text-off-white">11:00–23:00</span></div>
								<div className="flex justify-between"><span className="text-muted-gray">Sunday:</span><span className="text-off-white">12:00–21:00</span></div>
							</div>
						</div>
						<div className="location-section">
							<h3 className="font-cinzel text-xl font-semibold text-gold mb-4">Find Us</h3>
							<div className="h-32 bg-marble-black/50 rounded-xl border border-gold/20 mb-4 flex items-center justify-center">
								<iframe title="map" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2849.123!2d26.1234567!3d44.4123456!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDTCsDI0JzQ0LjQiTiAyNsKwMDcnMjQuNCJF!5e0!3m2!1sen!2sro!4v1234567890" className="w-full h-full rounded-xl" style={{ border: 0 }} allowFullScreen loading="lazy"></iframe>
							</div>
							<a href="#" className="inline-flex items-center space-x-2 text-gold hover:text-deep-gold transition-colors"><i className="fas fa-directions"></i><span>Get Directions</span></a>
						</div>
					</div>
					<div className="gold-line mb-6"></div>
					<div className="flex flex-col space-y-4 md:flex-row md:justify-between md:items-center md:space-y-0">
						<div className="flex items-center space-x-4 text-sm text-muted-gray">
							<span>© 2025 Tress²</span>
							<a href="#" className="hover:text-gold transition-colors">Privacy Policy</a>
							<span>|</span>
							<a href="#" className="hover:text-gold transition-colors">Terms of Service</a>
						</div>
						<div className="flex space-x-4">
							<a href="#" className="text-gold hover:text-deep-gold transition-colors"><i className="fab fa-instagram text-xl"></i></a>
							<a href="#" className="text-gold hover:text-deep-gold transition-colors"><i className="fab fa-facebook text-xl"></i></a>
							<a href="#" className="text-gold hover:text-deep-gold transition-colors"><i className="fab fa-tiktok text-xl"></i></a>
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
}


