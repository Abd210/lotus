import React from 'react';
import { db, storage } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { signOutUser, useAuth } from '../auth';
import { useToast } from '../components/Toast';

function useCategories(refresh) {
	const [categories, setCategories] = React.useState([]);
	React.useEffect(() => {
		(async () => {
			const snap = await getDocs(collection(db, 'categories'));
			const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
			list.sort((a,b)=>{
				const an = (a?.name_ro || (a?.name?.ro) || (a?.name?.en) || a?.name || '').toString().toLowerCase();
				const bn = (b?.name_ro || (b?.name?.ro) || (b?.name?.en) || b?.name || '').toString().toLowerCase();
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
	const getName = (c) => (c?.name && (c.name[lang] || c.name.en || c.name.ro)) || c?.name || '';
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

export default function Admin() {
	const { user } = useAuth();
	const { showToast, ToastComponent } = useToast();
	const [refreshKey, setRefreshKey] = React.useState(0);
	const categories = useCategories(refreshKey);
	const products = useProducts(refreshKey);
	const footerSettings = useFooterSettings(refreshKey);
	const [adminLang, setAdminLang] = React.useState('ro');
	const pathOptions = React.useMemo(() => buildPathMap(categories, adminLang), [categories, adminLang]);

	// Category form state
	const [editingCat, setEditingCat] = React.useState(null);
	const [catNames, setCatNames] = React.useState({ en: '', ro: '', ar: '' });
	const [parentId, setParentId] = React.useState('');
	const [catImage, setCatImage] = React.useState(null);

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

	async function uploadToStorage(file, folder) {
		const fileRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
		const res = await uploadBytes(fileRef, file);
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
			
			if (editingCat) {
				await updateDoc(doc(db, 'categories', editingCat.id), {
					name: {
						en: catNames.en.trim(),
						ro: catNames.ro.trim(),
						ar: catNames.ar.trim()
					},
					name_ro: catNames.ro.trim(),
					parentId: parentId || null,
					...(catImage ? { imageUrl } : {})
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
					createdAt: Date.now()
				});
				showToast('Category added successfully!', 'success');
			}
			
			setCatNames({ en: '', ro: '', ar: '' }); setParentId(''); setCatImage(null); setEditingCat(null);
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
							<div className="flex gap-2">
								<button type="submit" className="px-4 py-2 bg-gold text-black rounded hover:bg-deep-gold flex-1">{editingCat ? 'Update' : 'Add'} Category</button>
								{editingCat && (
									<button type="button" onClick={() => { setEditingCat(null); setCatNames({ en:'', ro:'', ar:'' }); setParentId(''); setCatImage(null); }} className="px-4 py-2 bg-muted-gray/20 text-off-white rounded hover:bg-muted-gray/30">Cancel</button>
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

				{/* Lists Section */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
					{/* Categories List */}
					<section className="bg-marble-black/80 border border-gold/30 rounded-xl p-6">
						<h2 className="font-cinzel text-xl text-gold mb-4">All Categories ({categories.length})</h2>
						<div className="space-y-2 max-h-96 overflow-y-auto">
							{categories.map(cat => (
								<div key={cat.id} className="flex items-center justify-between p-3 bg-black/40 rounded border border-gold/10 hover:border-gold/30 transition-colors">
									<div className="flex-1">
										<p className="text-off-white font-medium">{(cat?.name && (cat.name[adminLang] || cat.name.en || cat.name.ro)) || cat?.name}</p>
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
						<h2 className="font-cinzel text-xl text-gold mb-4">All Products ({products.length})</h2>
						<div className="space-y-2 max-h-96 overflow-y-auto">
							{products.map(prod => (
								<div key={prod.id} className="flex items-center justify-between p-3 bg-black/40 rounded border border-gold/10 hover:border-gold/30 transition-colors">
									<div className="flex-1">
										<p className="text-off-white font-medium">{(prod?.name && (prod.name[adminLang] || prod.name.en || prod.name.ro)) || prod?.name}</p>
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
											required 
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
			</main>
	{ToastComponent}
</div>
);
}
