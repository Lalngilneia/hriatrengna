#!/bin/bash
# ============================================================
# MemorialQR — VPS Setup Script
# Run as root on a fresh Ubuntu 22.04 DigitalOcean droplet
# Usage: bash setup.sh
# ============================================================

set -e  # Exit on any error

echo ""
echo "✦ MemorialQR Server Setup"
echo "────────────────────────────────────────"
echo ""

# ── 1. SYSTEM UPDATES ────────────────────────────────────────
echo "[1/9] Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. NODE.JS 20 LTS ────────────────────────────────────────
echo "[2/9] Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
echo "  Node: $(node --version)"
echo "  npm:  $(npm --version)"

# ── 3. POSTGRESQL ─────────────────────────────────────────────
echo "[3/9] Installing PostgreSQL..."
apt-get install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Create database and user
echo "[3/9] Creating database..."
sudo -u postgres psql <<SQL
CREATE USER memorialqr_user WITH PASSWORD 'CHANGE_THIS_PASSWORD_NOW';
CREATE DATABASE memorialqr OWNER memorialqr_user;
GRANT ALL PRIVILEGES ON DATABASE memorialqr TO memorialqr_user;
SQL

echo "  ⚠️  IMPORTANT: Change the database password above before going live!"

# ── 4. NGINX ──────────────────────────────────────────────────
echo "[4/9] Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx

# ── 5. CERTBOT (SSL) ──────────────────────────────────────────
echo "[5/9] Installing Certbot for SSL..."
apt-get install -y certbot python3-certbot-nginx

# ── 6. PM2 ────────────────────────────────────────────────────
echo "[6/9] Installing PM2 process manager..."
npm install -g pm2
pm2 startup systemd -u root --hp /root

# ── 7. FIREWALL ───────────────────────────────────────────────
echo "[7/9] Configuring firewall..."
apt-get install -y ufw
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "  Firewall configured."

# ── 8. APP DIRECTORY ──────────────────────────────────────────
echo "[8/9] Creating app directory..."
mkdir -p /var/www/memorialqr/logs
cd /var/www/memorialqr

echo ""
echo "────────────────────────────────────────"
echo "✦ Server setup complete!"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Upload your code to /var/www/memorialqr/"
echo "   scp -r ./memorialqr/* root@YOUR_SERVER_IP:/var/www/memorialqr/"
echo ""
echo "2. Set your domain's DNS A records:"
echo "   @ (root)  → YOUR_SERVER_IP"
echo "   api       → YOUR_SERVER_IP"
echo "   www       → YOUR_SERVER_IP"
echo ""
echo "3. Copy and configure Nginx:"
echo "   cp /var/www/memorialqr/devops/nginx.conf /etc/nginx/sites-available/memorialqr"
echo "   nano /etc/nginx/sites-available/memorialqr   # Replace yourdomain.com"
echo "   ln -s /etc/nginx/sites-available/memorialqr /etc/nginx/sites-enabled/"
echo "   nginx -t && systemctl reload nginx"
echo ""
echo "4. Get SSL certificate:"
echo "   certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com"
echo ""
echo "5. Set up environment variables:"
echo "   cp /var/www/memorialqr/backend/.env.example /var/www/memorialqr/backend/.env"
echo "   nano /var/www/memorialqr/backend/.env   # Fill in all values"
echo ""
echo "6. Run database migrations:"
echo "   PGPASSWORD=YOUR_DB_PASSWORD psql -U memorialqr_user -d memorialqr -f /var/www/memorialqr/schema.sql"
echo ""
echo "7. Install dependencies and build:"
echo "   cd /var/www/memorialqr/backend && npm install --production"
echo "   cd /var/www/memorialqr/frontend && npm install && npm run build"
echo ""
echo "8. Start the app:"
echo "   cd /var/www/memorialqr"
echo "   cp devops/ecosystem.config.js ."
echo "   pm2 start ecosystem.config.js --env production"
echo "   pm2 save"
echo ""
echo "9. Configure Stripe webhook:"
echo "   In Stripe Dashboard → Webhooks → Add endpoint:"
echo "   URL: https://api.yourdomain.com/api/payments/webhook"
echo "   Events: customer.subscription.created, customer.subscription.updated,"
echo "           customer.subscription.deleted, invoice.payment_failed"
echo ""
echo "✦ Your MemorialQR app will be live at https://yourdomain.com"
echo "────────────────────────────────────────"
