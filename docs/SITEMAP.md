# Spendigo Site Map

## 🛍️ Consumer App (Public)

### Core Navigation
- `[GET] /` - **Home**: Store listings, hero banner, featured stats.
- `[GET] /search` - **Search**: Global product search filtered by category/store.
- `[GET] /smartcart` - **SmartCart**: Wishlist optimization engine (Cheapest Price Finder).
- `[GET] /how-it-works` - **How It Works**: Explainer page for the Optimizer.
- `[GET] /cart` - **Shopping Cart**: Manage items and quantities.
- `[GET] /checkout` - **Checkout**: Payment, delivery address, and order placement.

### Store & Product
- `[GET] /store/:id` - **Store Detail**: Products, flyers, deals, and ratings for a store.
- `[GET] /product/:id` - **Product Detail**: Product info, images, and add-to-cart.

### User Account
- `[GET] /profile` - **Profile**: User settings, saved addresses, order history.
- `[GET] /notifications` - **Notifications**: Price drop alerts and order updates.
- `[GET] /order/:id` - **Order Tracking**: Visual timeline of active orders.

## 👔 Merchant Admin (Secure)

### Dashboard
- `[GET] /merchant/dashboard` - **Overview**: Sales stats, recent orders, quick actions.

### Management
- `[GET] /merchant/products` - **Product Catalog**: Add/Edit/Delete products, manage stock.
- `[GET] /merchant/orders` - **Order Manager**: View incoming orders, update status (Preparing/Ready).
- `[GET] /merchant/flyers` - **Flyers**: Create and manage weekly digital flyers.
- `[GET] /merchant/deals` - **Deals**: Create one-day offers and clearance sales.
- `[GET] /merchant/onboarding` - **Settings**: Store profile and configuration.

## 🔐 Authentication
- `[GET] /login` - **Login**: Universal login for Consumers and Merchants.
- `[GET] /register` - **Register**: New account creation.

## 🛡️ System Admin
- `[GET] /admin/users` - **User Management**: Administrator view for user oversight.
