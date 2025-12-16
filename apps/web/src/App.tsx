import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import StoreList from './pages/consumer/StoreList';
import ProductDetail from './pages/consumer/ProductDetail';
import Cart from './pages/consumer/Cart';
import MerchantOnboarding from './pages/merchant/Onboarding';
import MerchantOrderManager from './pages/merchant/OrderManager';
import AdminUserManagement from './pages/admin/UserManagement';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<StoreList />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/merchant/onboarding" element={<MerchantOnboarding />} />
                <Route path="/merchant/orders" element={<MerchantOrderManager />} />
                <Route path="/admin/users" element={<AdminUserManagement />} />
            </Routes>
        </Router>
    );
}

export default App;
