import React from 'react';
import './App.css';
import Menu from './pages/Menu';
import Admin from './pages/Admin';
import CategoryProducts from './pages/CategoryProducts';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './auth';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
	return (
		<AuthProvider>
			<BrowserRouter>
				<Routes>
					<Route path="/" element={<Menu />} />
					<Route path="/category/:categoryId" element={<CategoryProducts />} />
					<Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
				</Routes>
			</BrowserRouter>
		</AuthProvider>
	);
}

export default App;
