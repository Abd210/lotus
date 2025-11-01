import React from 'react';
import './App.css';
import Menu from './pages/Menu';
import Admin from './pages/Admin';
import CategoryProducts from './pages/CategoryProducts';
import ProductDetail from './pages/ProductDetail';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './auth';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from './i18n';

function App() {
	return (
		<AuthProvider>
			<I18nProvider>
			<BrowserRouter>
				<Routes>
					<Route path="/" element={<Menu />} />
					<Route path="/category/:categoryId" element={<CategoryProducts />} />
					<Route path="/product/:productId" element={<ProductDetail />} />
					<Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
				</Routes>
			</BrowserRouter>
			</I18nProvider>
		</AuthProvider>
	);
}

export default App;
