# MediKiosk — Smart Healthcare Kiosk Platform

A full-stack healthcare kiosk and doctor portal web application built for government hospital self-service check-in, ABDM integration, and OPD queue management.

---

## 📁 Repository Structure

```
MediKiosk/
├── frontend/             # React App (Vite + Tailwind CSS + React Router)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── KioskPage.jsx       # Patient-facing Kiosk UI (/kiosk)
│   │   │   ├── DoctorDashboard.jsx # Physician OPD Dashboard (/doctor)
│   │   │   └── AdminPanel.jsx      # System & Health Control Panel (/admin)
│   │   ├── App.jsx                 # Routing & Top Switcher Navigation
│   │   ├── main.jsx                # Entry point
│   │   └── index.css               # Tailwind CSS & accessible theme primitives
│   ├── tailwind.config.js          # Accessibility config (24px+ button fonts, 18px body)
│   └── vite.config.js              # Vite server (port 5173)
│
├── backend/              # Node.js + Express API Server
│   ├── server.js                   # Express Server (port 3000, CORS enabled)
│   └── mockData/                   # JSON schemas & mock data
│       ├── patientSessions.json    # Simulated check-in sessions & vitals
│       ├── abdmResponses.json      # ABDM ABHA verification payloads
│       └── hisResponses.json       # Hospital Information System queue payloads
│
└── README.md             # Setup and developer guide
```

---

## 🚀 How to Run Locally

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

---

### Step 1: Start the Backend API Server

Open a terminal window and run:

```bash
cd backend
npm install
npm run dev
```

- The API server will start on **`http://localhost:3000`**
- CORS is configured to accept requests from **`http://localhost:5173`**
- API Health Check endpoint: `GET http://localhost:3000/api/health`

---

### Step 2: Start the Frontend React App

Open a second terminal window and run:

```bash
cd frontend
npm install
npm run dev
```

- The React application will start on **`http://localhost:5173`**
- Open `http://localhost:5173` in your browser.

---

## 🌐 Navigating the Application

The frontend includes a top navigation bar allowing quick switching between the 3 views:

1. **`/kiosk` — Patient-Facing Kiosk View**
   - High contrast UI, large touch target buttons (min 80px touch height, 26px+ font sizes).
   - Multi-lingual selection (English, Hindi, Telugu).
   - Touch-optimized check-in and vitals entry flows.

2. **`/doctor` — Physician OPD Dashboard**
   - Active patient vitals summary, chief complaint inspector, and live token queue listing.

3. **`/admin` — Demo Control Panel**
   - Live backend health status check (`/api/health`) verifying CORS connection between port 5173 and port 3000.
   - Mock data schema inspectors.

---

## ♿ Accessibility & Kiosk UI Design Features

- **Font Sizes**: Body text minimum 18px (`1.125rem`), Button text 24px–26px (`font-bold`).
- **Touch Targets**: Minimum touch target height 64px to 80px with generous interactive padding.
- **Color Contrast**: Deep navy (`#0F172A`), high-visibility blue (`#1E40AF`), emerald (`#047857`), and gold accents.

---

## 📝 Upgrade Changelog

### Phase 1: Foundation Hardening (Auth, RBAC, Env Config, Git Hygiene)
- **Environment Config**: Created `.env` and `.env.example` to consolidate DB URLs and JWT secrets.
- **Git Hygiene**: Updated `.gitignore` to secure `.env` files.
- **Prisma Schema**: Added `StaffUser` model to schema alongside existing `Patient` models.
- **Authentication**: Implemented JWT-based authentication in `authService.js` (backend and frontend). Secured patient passwords using `bcrypt`.
- **RBAC Middleware**: Introduced `requireRole` middleware in `auth.js` to protect `/api/admin`, `/api/sessions`, and `/api/his` routes.
- **Staff Portal**: Added `StaffLoginPage.jsx` and updated `App.jsx` with a `ProtectedRoute` wrapper for `/doctor` and `/admin` routes.
