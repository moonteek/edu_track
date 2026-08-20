# EduTrack — Learning Management System

A full-stack LMS built with React + Vite (frontend) and Express + MongoDB (backend), deployable to Render and Vercel.

## Project Structure

```
edutrack/
├── api/
│   └── index.js          # Express app entry point & REST API
├── lib/
│   ├── db.js             # Mongoose connection with DNS caching
│   ├── seed.js           # Initial data & admin seeder
│   └── create-admin.js   # CLI utility to create admin accounts
├── models/
│   ├── Admin.js          # Admin model
│   ├── Teacher.js        # Teacher model
│   └── Group.js          # Group model
├── frontend/             # React + Vite frontend SPA
│   ├── src/
│   │   ├── pages/        # Admin overview, groups, teachers, schedule, admins
│   │   ├── components/   # UI components (LevelBar, TeacherCard, GroupRow, etc.)
│   │   ├── constants.js  # Courses, levels, calendar auto-progress
│   │   └── api.js        # Fetch API client with auth handling
│   └── package.json
├── render.yaml           # Backend deployment blueprint (Render)
├── package.json
└── README.md
```

## Running Locally

### 1. Prerequisites
- **Node.js**: v18 or newer
- **MongoDB**: MongoDB Atlas connection string or local MongoDB instance

### 2. Configure Environment Variables
Ensure you have a `.env` file in the project root:
```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
PORT=5000
```

### 3. Install Dependencies
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 4. Start the Application

Open two terminal windows:

**Terminal 1 (Backend API - Port 5000):**
```bash
npm run dev
# or
node api/index.js
```

**Terminal 2 (Frontend - Port 5173):**
```bash
npm run dev:frontend
# or
cd frontend && npm run dev
```

* Frontend will be available at: **`http://localhost:5173`**
* Backend API will run at: **`http://localhost:5000`** (Vite automatically proxies `/api` requests to port 5000 during local development).

---

## Adding New Admins

You can create and manage administrators in two ways:

### Option A: From the Web UI (Recommended)
1. Log in to the Admin Panel as an administrator.
2. Navigate to the **Admins** tab in the navigation bar.
3. Click the **"+ Add Admin"** button.
4. Enter the desired **Username** and **Password** and click **Create Admin**.

### Option B: From the Terminal (CLI)
Run the admin creation script from the project root:
```bash
# Usage: npm run create-admin <username> <password>
npm run create-admin superadmin mySecurePassword123

# Or directly with node:
node lib/create-admin.js superadmin mySecurePassword123
```

---

## Default Credentials (After Seeding)

- **Default Admin:** `admin` / `admin123` (or values from your `.env`)
- **Demo Teachers:** `alisher.n`, `malika.y`, `bobur.t`, `dilnoza.r`, `sardor.m` (Password: `teacher123`)
