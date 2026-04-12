# ✦ MemorialQR

> Preserve legacies with a beautiful digital memorial album and a unique QR code.
> Built with Node.js, Next.js, PostgreSQL, Cloudflare R2, Razorpay, and Resend.

---

## 📁 Project Structure

```
memorialqr/
├── backend/                   ← Node.js + Express API
│   ├── src/
│   │   ├── controllers/       auth, album, media, payment, admin, public
│   │   ├── services/          email (Resend), storage (Cloudflare R2)
│   │   ├── routes/            all API route definitions
│   │   ├── middleware/        JWT auth, admin auth, file upload
│   │   └── utils/             PostgreSQL db pool
│   ├── .env.example           copy to .env and fill in values
│   └── package.json
│
├── frontend/                  ← Next.js app
│   ├── pages/
│   │   ├── index.jsx          Main app (landing, auth, dashboard, create, QR, public view)
│   │   └── admin.jsx          Super Admin dashboard
│   ├── lib/
│   │   ├── api.js             API helper (fetch wrapper with auth)
│   │   └── razorpay.js        Razorpay checkout helper
│   └── .env.example           copy to .env.local and fill in values
│
├── devops/
│   ├── setup.sh               One-command VPS setup (Ubuntu 22.04)
│   ├── nginx.conf             Nginx reverse proxy config
│   └── ecosystem.config.js    PM2 process manager config
│
├── schema.sql                 PostgreSQL database schema (run once)
└── README.md                  You are here
```

---

## 🚀 Quick Start (Local)

### 1. Prerequisites
- Node.js 20+ — https://nodejs.org
- PostgreSQL 15+ — https://postgresql.org/download

### 2. Database
```bash
# Create user and database
psql -U postgres
CREATE USER memorialqr_user WITH PASSWORD 'localpassword123';
CREATE DATABASE memorialqr OWNER memorialqr_user;
GRANT ALL PRIVILEGES ON DATABASE memorialqr TO memorialqr_user;
\q

# Run schema
psql -U memorialqr_user -d memorialqr -f schema.sql
```

### 3. Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your values (see .env.example comments)
npm install
npm run dev
# → API running at http://localhost:4000
```

### 4. Frontend
```bash
cd frontend
cp .env.example .env.local
# Edit .env.local
npm install
npm run dev
# → App running at http://localhost:3000
# → Admin at http://localhost:3000/admin
```

### 5. Test the API
```bash
curl http://localhost:4000/health
curl http://localhost:4000/api/payments/plans
```

---

## 🔑 Default Admin Login
- **URL:** http://localhost:3000/admin
- **Email:** admin@memorialqr.com
- **Password:** Admin@12345
- ⚠️ Change this immediately after first login!

---

## 🌍 Deploy to DigitalOcean VPS

```bash
# 1. SSH into your fresh Ubuntu 22.04 VPS
ssh root@YOUR_SERVER_IP

# 2. Run the setup script
bash setup.sh

# 3. Upload your code
scp -r ./ root@YOUR_SERVER_IP:/var/www/memorialqr/

# 4. Follow the printed instructions
```

Full instructions in `devops/setup.sh`.

---

## 📧 Email System (Resend)
6 transactional emails built-in:
- Welcome email on signup
- Email verification link
- Password reset link
- Album created confirmation
- Subscription renewal reminder (7 days before)
- Subscription expiry warning (14 days before cancel)

---

## 💳 Payments (Razorpay — INR)
- Supports: UPI, Cards, Netbanking, Wallets
- Plans: ₹749/month · ₹6,999/year
- Subscription management via Admin panel
- Webhook handles: activated, charged, cancelled, halted, payment_failed

**Test card:** 4111 1111 1111 1111 · Any expiry · Any CVV · OTP: 1234
**Test UPI:** success@razorpay

---

## ☁️ File Storage (Cloudflare R2)
- Photos: max 20MB
- Videos: max 500MB
- Audio: max 50MB
- All files served via R2 public URL

---

## 🛠 Tech Stack
| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18 |
| Backend | Node.js, Express 4 |
| Database | PostgreSQL 15 |
| File Storage | Cloudflare R2 (S3-compatible) |
| Payments | Razorpay (INR) |
| Email | Resend |
| Auth | JWT (separate user + admin tokens) |
| QR Codes | qrcode.js |
| Server | DigitalOcean VPS, Nginx, PM2 |
