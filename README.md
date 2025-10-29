# Lotus Restaurant Menu App

A luxury restaurant menu management system built with React and Firebase.

## Features

- **Public Menu**: Beautiful marble-themed menu display with categories
- **Admin Panel**: Secure admin-only interface to manage categories and products
- **Firebase Backend**: No server needed - everything runs on Firebase
- **Hierarchical Categories**: Unlimited nesting of categories (category > subcategory > sub-subcategory...)
- **Image Uploads**: Upload category and product images to Firebase Storage
- **Real-time Updates**: Changes reflect immediately

## Setup

### 1. Firebase Console Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **lotus-9740e**

#### Enable Authentication
- Click **Authentication** → **Sign-in method**
- Enable **Google** provider → Save

#### Set Firestore Rules
- Click **Firestore Database** → **Rules** tab
- Copy rules from `firestore.rules` file
- Click **Publish**

#### Set Storage Rules
- Click **Storage** → **Rules** tab
- Copy rules from `storage.rules` file  
- Click **Publish**

### 2. Run the App

```bash
npm install
npm start
```

- **Public Menu**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin (sign in with lotuscaffe5@gmail.com)

## Usage

### Admin Panel (`/admin`)

1. Sign in with Google using your admin email (lotuscaffe5@gmail.com)

2. **Add Categories**:
   - Enter category name
   - Optionally select a parent category (for nesting)
   - Upload image (optional)
   - Categories auto-refresh in dropdown after adding

3. **Add Products**:
   - Enter product name, description, price
   - Select category from dropdown
   - Upload product image
   - Products belong to one category

### Public Menu (`/`)

- Click on any category card to navigate into it
- Drawer menu shows all top-level categories and their children
- **Smart Navigation**:
  - Category with subcategories → Shows subcategory cards (click to drill down)
  - Category with products → Shows product grid
  - Category with both → Shows subcategories first, then products below
- Unlimited nesting depth supported

## Admin Email

Admin access is hardcoded in `src/auth.js`:

```javascript
const ADMIN_EMAILS = ['lotuscaffe5@gmail.com'];
```

To add more admins, update this array.

## Tech Stack

- React 19 (Create React App)
- Firebase 12 (Auth, Firestore, Storage)
- Tailwind CSS 3
- React Router 6

## File Structure

```
src/
├── auth.js              # Authentication context & admin check
├── firebase.js          # Firebase initialization
├── components/
│   └── ProtectedRoute.js # Admin-only route wrapper
├── pages/
│   ├── Menu.js          # Public menu homepage
│   ├── CategoryProducts.js  # Category product listing
│   └── Admin.js         # Admin panel
└── App.js              # Routes
```

## Deployment

1. Build: `npm run build`
2. Deploy `build/` folder to Firebase Hosting or any static host

---

**Admin Email**: lotuscaffe5@gmail.com  
**Project**: lotus-9740e
