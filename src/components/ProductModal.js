import React from 'react';

export default function ProductModal({ product, onClose }) {
	if (!product) return null;

	return (
		<>
			{/* Backdrop */}
			<div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={onClose}></div>
			
			{/* Modal */}
			<div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
				<div 
					className="bg-gradient-to-br from-marble-black via-black to-marble-black border-2 border-gold/40 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
					onClick={(e) => e.stopPropagation()}
				>
					{/* Close Button */}
					<button 
						onClick={onClose}
						className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center bg-marble-black/80 border border-gold/30 rounded-full text-gold hover:bg-gold hover:text-black transition-all"
					>
						<i className="fas fa-times text-lg"></i>
					</button>

					{/* Image Section */}
					{product.imageUrl && (
						<div className="relative h-80 md:h-96 overflow-hidden rounded-t-2xl">
							<img 
								src={product.imageUrl} 
								alt={product.name}
								className="w-full h-full object-cover"
							/>
							<div className="absolute inset-0 bg-gradient-to-t from-marble-black via-transparent to-transparent"></div>
						</div>
					)}

					{/* Content Section */}
					<div className="p-8 md:p-12">
						{/* Title & Price */}
						<div className="mb-6 pb-6 border-b border-gold/20">
							<h2 className="font-cinzel text-3xl md:text-4xl text-gold mb-3">{product.name}</h2>
							<div className="flex items-center gap-4">
								<span className="text-4xl font-semibold text-gold">{product.price} LEI</span>
							</div>
						</div>

						{/* Description */}
						{product.description && (
							<div className="mb-8">
								<h3 className="font-cinzel text-xl text-gold mb-3">Description</h3>
								<p className="text-off-white leading-relaxed text-lg whitespace-pre-line">
									{product.description}
								</p>
							</div>
						)}

						{/* Decorative Line */}
						<div className="gold-line my-8"></div>

						{/* Additional Info (Optional - can be added later) */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
							<div className="flex items-center gap-3">
								<i className="fas fa-utensils text-gold text-lg"></i>
								<span className="text-muted-gray">Freshly prepared</span>
							</div>
							<div className="flex items-center gap-3">
								<i className="fas fa-leaf text-gold text-lg"></i>
								<span className="text-muted-gray">Quality ingredients</span>
							</div>
						</div>

						{/* Call to Action */}
						<div className="mt-8 pt-6 border-t border-gold/20">
							<button 
								onClick={onClose}
								className="w-full md:w-auto px-8 py-3 bg-gold text-black font-semibold rounded-lg hover:bg-deep-gold transition-all shadow-lg hover:shadow-gold/20"
							>
								<i className="fas fa-arrow-left mr-2"></i>
								Back to Menu
							</button>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}



