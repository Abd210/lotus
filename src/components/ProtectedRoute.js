import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, signInWithGoogle } from '../auth';

export default function ProtectedRoute({ children }) {
	const { user, isAdmin, loading } = useAuth();

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-marble-black text-off-white">
				<p>Loading…</p>
			</div>
		);
	}

	if (!user) {
		return (
			<div className="min-h-screen flex items-center justify-center marble-bg marble-overlay">
				<div className="bg-marble-black/90 border border-gold/30 rounded-xl p-8 text-center text-off-white">
					<h2 className="font-cinzel text-2xl text-gold mb-4">Admin Sign In</h2>
					<button onClick={signInWithGoogle} className="px-4 py-2 bg-gold text-black rounded hover:bg-deep-gold">Sign in with Google</button>
				</div>
			</div>
		);
	}

	if (!isAdmin) {
		return <Navigate to="/" replace />;
	}

	return children;
}


