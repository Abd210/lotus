import React from 'react';

export default function ProductModal({ product, onClose }) {
	const contentRef = React.useRef(null);

	// Lock body scroll and reset content scroll when a product is opened
	React.useEffect(() => {
		if (!product) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		if (contentRef.current) contentRef.current.scrollTop = 0;
		return () => {
			document.body.style.overflow = prev || '';
		};
	}, [product]);

	if (!product) return null;

	return (
		<>
			{/* Backdrop */}
			<div
				className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50"
				onClick={onClose}
			></div>

			{/* Fixed popup: top aligned, centered horizontally; internal scroll only */}
			<div
				className="fixed z-50 top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg"
				onClick={onClose}
			>
				<div
					className="relative bg-gradient-to-br from-marble-black via-black to-marble-black border-2 border-gold/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
					onClick={(e) => e.stopPropagation()}
				>
					{/* Close Button */}
					<button
						onClick={onClose}
						className="absolute top-3 right-3 z-20 w-10 h-10 flex items-center justify-center bg-black/80 border-2 border-gold rounded-full text-gold active:bg-gold active:text-black transition-all shadow-lg"
					>
						<i className="fas fa-times text-lg"></i>
					</button>

					{/* Image */}
					{product.imageUrl && (
						<div className="relative h-48 overflow-hidden">
							<img
								src={product.imageUrl}
								alt={product.name}
								className="w-full h-full object-cover"
								loading="eager"
								decoding="async"
							/>
							<div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
						</div>
					)}

					{/* Scrollable content */}
					<div ref={contentRef} className="flex-1 overflow-y-auto p-5">
						<div className="mb-4 pb-4 border-b border-gold/20">
							<h2 className="font-cinzel text-xl text-gold mb-2">{product.name}</h2>
							<span className="text-2xl font-semibold text-gold">{product.price} LEI</span>
						</div>
						{product.description && (
							<div className="mb-4">
								<h3 className="font-cinzel text-base text-gold mb-2">Description</h3>
								<p className="text-off-white leading-relaxed text-sm whitespace-pre-line">{product.description}</p>
							</div>
						)}
						<div className="gold-line my-4"></div>
						<div className="grid grid-cols-2 gap-3 mb-4">
							<div className="flex items-center gap-2">
								<i className="fas fa-utensils text-gold text-sm"></i>
								<span className="text-muted-gray text-xs">Freshly prepared</span>
							</div>
							<div className="flex items-center gap-2">
								<i className="fas fa-leaf text-gold text-sm"></i>
								<span className="text-muted-gray text-xs">Quality ingredients</span>
							</div>
						</div>
						<div className="pt-4 border-t border-gold/20">
							<button
								onClick={onClose}
								className="w-full px-6 py-2.5 bg-gold text-black font-semibold rounded-lg active:bg-deep-gold transition-all shadow-lg text-sm"
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





