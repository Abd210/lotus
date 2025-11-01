import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import LoadingOverlay from '../components/LoadingOverlay';
import { getProductCache, setProductCache } from '../utils/cache';

export default function ProductDetail() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const [product, setProduct] = React.useState(null);
  const [notFound, setNotFound] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const cached = getProductCache(productId);
    if (cached) {
      setProduct(cached);
    } else {
      setLoading(true);
    }
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'products', productId));
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() };
          setProduct(data);
          setProductCache(productId, data);
        } else {
          setNotFound(true);
        }
      } catch (e) {
        console.error('Failed to load product', e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  return (
    <div className="min-h-screen marble-bg marble-overlay text-off-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-marble-black/90 backdrop-blur-md border-b border-gold/20">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="w-20 flex items-center">
              <button onClick={() => navigate(-1)} className="text-gold active:opacity-70"><i className="fas fa-arrow-left text-lg"></i></button>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <img src="/lotus-logo.png" alt="Lotus" className="h-16 w-auto cursor-pointer active:opacity-70" onClick={() => navigate('/')} />
            </div>
            <div className="w-20"></div>
          </div>
        </div>
        <div className="gold-line mx-4"></div>
      </header>

      <main className="px-4 py-8 max-w-4xl mx-auto">
        {notFound && (
          <div className="text-center py-16">
            <h2 className="font-cinzel text-2xl text-gold mb-3">Product not found</h2>
            <button onClick={() => navigate(-1)} className="text-gold underline">Go back</button>
          </div>
        )}

        {product && (
          <div className="bg-marble-black/80 border border-gold/30 rounded-2xl overflow-hidden shadow-xl">
            {/* Image */}
            {product.imageUrl && (
              <div className="relative h-80 md:h-96 overflow-hidden">
                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" loading="eager" decoding="async" />
                <div className="absolute inset-0 bg-gradient-to-t from-marble-black via-transparent to-transparent"></div>
              </div>
            )}

            {/* Content */}
            <div className="p-6 md:p-10">
              <div className="mb-6 pb-6 border-b border-gold/20">
                <h1 className="font-cinzel text-3xl md:text-4xl text-gold mb-2">{product.name}</h1>
                <div className="text-3xl font-semibold text-gold">{product.price} LEI</div>
              </div>

              {product.description && (
                <div className="mb-8">
                  <h3 className="font-cinzel text-xl text-gold mb-3">Description</h3>
                  <p className="text-off-white/90 leading-relaxed whitespace-pre-line">{product.description}</p>
                </div>
              )}

              <div className="gold-line my-8"></div>

              <div className="flex flex-wrap gap-3">
                <button onClick={() => navigate(-1)} className="px-6 py-3 bg-gold text-black font-semibold rounded-lg hover:bg-deep-gold transition-colors">
                  <i className="fas fa-arrow-left mr-2"></i> Back
                </button>
                <button onClick={() => navigate('/')} className="px-6 py-3 border border-gold/40 text-gold rounded-lg hover:bg-gold/10 transition-colors">
                  Go to Home
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      {loading && !product ? <LoadingOverlay text="Loading product…" /> : null}
    </div>
  );
}
