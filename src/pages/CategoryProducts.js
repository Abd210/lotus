import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import ProductModal from '../components/ProductModal';

export default function CategoryProducts() {
	const { categoryId } = useParams();
	const navigate = useNavigate();
	const [category, setCategory] = React.useState(null);
	const [subcategories, setSubcategories] = React.useState([]);
	const [products, setProducts] = React.useState([]);
	const [selectedProduct, setSelectedProduct] = React.useState(null);

	React.useEffect(() => {
		(async () => {
			try {
				// Get current category
				const catDoc = await getDoc(doc(db, 'categories', categoryId));
				if (catDoc.exists()) setCategory({ id: catDoc.id, ...catDoc.data() });

				// Get subcategories
				const subsSnap = await getDocs(query(collection(db, 'categories'), where('parentId', '==', categoryId)));
				setSubcategories(subsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

				// Get products
				const productsSnap = await getDocs(query(collection(db, 'products'), where('categoryId', '==', categoryId)));
				setProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
			} catch (e) {
				console.error(e);
			}
		})();
	}, [categoryId]);

	return (
		<div className="min-h-screen marble-bg marble-overlay text-off-white">
			<header className="sticky top-0 z-30 bg-marble-black/90 backdrop-blur-md border-b border-gold/20">
				<div className="px-4 py-4">
					<div className="flex items-center justify-between">
						<button onClick={() => navigate('/')} className="text-gold hover:text-deep-gold transition-colors"><i className="fas fa-arrow-left text-lg"></i></button>
						<div className="flex-1 text-center">
							<h1 className="font-cinzel text-2xl font-semibold text-gold italic">Tress²</h1>
						</div>
						<div className="w-6"></div>
					</div>
				</div>
				<div className="gold-line mx-4"></div>
			</header>

			<section className="py-8 px-4">
				<div className="text-center mb-8">
					<h2 className="font-cinzel text-3xl text-gold mb-2">{category?.name || 'Category'}</h2>
					<div className="gold-line max-w-32 mx-auto"></div>
				</div>

				{/* Subcategories Section */}
				{subcategories.length > 0 && (
					<div className="mb-12">
						<h3 className="font-cinzel text-2xl text-gold mb-6 text-center">Subcategories</h3>
						<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto mb-8">
							{subcategories.map(subcat => (
								<div 
									key={subcat.id} 
									onClick={() => navigate(`/category/${subcat.id}`)}
									className="category-card-container group cursor-pointer"
								>
									<div className="relative overflow-hidden rounded-xl border border-gold/30 gold-glow transition-all duration-250">
										<div className="h-40 overflow-hidden">
											<img 
												className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-250" 
												src={subcat.imageUrl || 'https://images.unsplash.com/photo-1541542684-4a6e4f9a82b4?q=80&w=1200&auto=format&fit=crop'} 
												alt={subcat.name} 
											/>
										</div>
										<div className="absolute inset-0 category-card"></div>
										<div className="absolute bottom-0 left-0 right-0 p-3">
											<h3 className="font-cinzel text-base font-semibold text-off-white">{subcat.name}</h3>
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
						<h3 className="font-cinzel text-2xl text-gold mb-6 text-center">Products</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
					{products.map(product => (
						<div 
							key={product.id} 
							onClick={() => setSelectedProduct(product)}
							className="bg-marble-black/80 border border-gold/30 rounded-xl overflow-hidden hover:border-gold hover:shadow-xl hover:shadow-gold/10 transition-all cursor-pointer group"
						>
							{product.imageUrl && (
								<div className="h-56 overflow-hidden relative">
									<img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
									<div className="absolute inset-0 bg-gradient-to-t from-marble-black via-transparent to-transparent opacity-60"></div>
								</div>
							)}
							<div className="p-5">
								<h3 className="font-cinzel text-xl text-gold mb-2 group-hover:text-deep-gold transition-colors">{product.name}</h3>
								{product.description && (
									<p className="text-off-white/80 text-sm mb-3 line-clamp-2">
										{product.description}
									</p>
								)}
								<div className="flex items-center justify-between">
									<p className="text-gold font-semibold text-xl">{product.price} LEI</p>
									<span className="text-gold text-sm opacity-0 group-hover:opacity-100 transition-opacity">
										View Details <i className="fas fa-arrow-right ml-1"></i>
									</span>
								</div>
							</div>
						</div>
					))}
					</div>
					</div>
				)}

				{/* Empty State */}
				{subcategories.length === 0 && products.length === 0 && (
					<div className="text-center py-12">
						<p className="text-muted-gray text-lg">This category is empty.</p>
						<p className="text-muted-gray text-sm mt-2">No subcategories or products have been added yet.</p>
					</div>
				)}
			</section>

		{/* Product Detail Modal */}
		{selectedProduct && (
			<ProductModal 
				product={selectedProduct} 
				onClose={() => setSelectedProduct(null)} 
			/>
		)}
	</div>
);
}

