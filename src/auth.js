import React from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

const AuthContext = React.createContext({ user: null, isAdmin: false });
const ADMIN_EMAILS = [
	'lotuscaffe5@gmail.com',
	'brands.brothers99@gmail.com'
];

export function AuthProvider({ children }) {
	const [user, setUser] = React.useState(null);
	const [loading, setLoading] = React.useState(true);

	React.useEffect(() => {
		const unsub = onAuthStateChanged(auth, (u) => {
			setUser(u);
			setLoading(false);
		});
		return unsub;
	}, []);

	const isAdmin = !!user && ADMIN_EMAILS.includes(user.email || '');

	const value = React.useMemo(() => ({ user, isAdmin, loading }), [user, isAdmin, loading]);

	return (
		<AuthContext.Provider value={value}>{children}</AuthContext.Provider>
	);
}

export function useAuth() {
	return React.useContext(AuthContext);
}

export async function signInWithGoogle() {
	await signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
	await signOut(auth);
}


