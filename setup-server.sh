#!/bin/bash
# ===================================
# إعداد السيرفر لأول مرة - HalManhaj
# ===================================
# الاستخدام: bash setup-server.sh
# يعمل على Ubuntu 22.04 / 24.04

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   🔧 إعداد سيرفر حل المنهج - HalManhaj${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ── تحقق من الصلاحيات ──
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ يجب تشغيل هذا السكربت كـ root (sudo)${NC}"
  exit 1
fi

# ── 1. تحديث النظام ──
echo -e "\n${YELLOW}📦 [1/8] تحديث النظام...${NC}"
apt update && apt upgrade -y

# ── 2. تثبيت Node.js 20 LTS ──
echo -e "\n${YELLOW}📦 [2/8] تثبيت Node.js 20 LTS...${NC}"
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo -e "  ${GREEN}✓ Node.js $(node -v)${NC}"
echo -e "  ${GREEN}✓ npm $(npm -v)${NC}"

# ── 3. تثبيت PostgreSQL ──
echo -e "\n${YELLOW}📦 [3/8] تثبيت PostgreSQL...${NC}"
if ! command -v psql &> /dev/null; then
  apt install -y postgresql postgresql-contrib
fi
systemctl enable postgresql
systemctl start postgresql
echo -e "  ${GREEN}✓ PostgreSQL مثبت ويعمل${NC}"

# ── 4. إنشاء قاعدة البيانات ──
echo -e "\n${YELLOW}🗄️ [4/8] إعداد قاعدة البيانات...${NC}"
read -p "  اسم قاعدة البيانات (halmanhaj): " DB_NAME
DB_NAME=${DB_NAME:-halmanhaj}
read -p "  اسم المستخدم (halmanhaj_user): " DB_USER
DB_USER=${DB_USER:-halmanhaj_user}
read -sp "  كلمة المرور: " DB_PASS
echo ""

sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "  المستخدم موجود مسبقاً"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || echo "  قاعدة البيانات موجودة مسبقاً"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
echo -e "  ${GREEN}✓ قاعدة البيانات جاهزة${NC}"

# ── 5. تثبيت PM2 ──
echo -e "\n${YELLOW}📦 [5/8] تثبيت PM2...${NC}"
npm install -g pm2
pm2 startup systemd -u $SUDO_USER --hp /home/$SUDO_USER
echo -e "  ${GREEN}✓ PM2 مثبت${NC}"

# ── 6. تثبيت Nginx ──
echo -e "\n${YELLOW}📦 [6/8] تثبيت Nginx...${NC}"
apt install -y nginx
systemctl enable nginx
systemctl start nginx
echo -e "  ${GREEN}✓ Nginx مثبت ويعمل${NC}"

# ── 7. نسخ المشروع ──
echo -e "\n${YELLOW}📂 [7/8] إعداد مجلد المشروع...${NC}"
PROJECT_DIR="/var/www/halmanhaj"
if [ ! -d "$PROJECT_DIR" ]; then
  mkdir -p $PROJECT_DIR
  git clone https://github.com/kaebs19/HalmanhajApi.git $PROJECT_DIR
  chown -R $SUDO_USER:$SUDO_USER $PROJECT_DIR
fi
echo -e "  ${GREEN}✓ المشروع في $PROJECT_DIR${NC}"

# ── 8. إعداد ملف البيئة ──
echo -e "\n${YELLOW}⚙️ [8/8] إنشاء ملف الإعدادات...${NC}"
ENV_FILE="$PROJECT_DIR/server/.env"
if [ ! -f "$ENV_FILE" ]; then
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
  cat > "$ENV_FILE" << EOF
PORT=5000
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
JWT_SECRET=${JWT_SECRET}
NODE_ENV=production
EOF
  chown $SUDO_USER:$SUDO_USER "$ENV_FILE"
  echo -e "  ${GREEN}✓ تم إنشاء .env${NC}"
else
  echo -e "  ${YELLOW}⚠ ملف .env موجود مسبقاً${NC}"
fi

# ── إعداد Nginx ──
echo -e "\n${YELLOW}🌐 إعداد Nginx...${NC}"
read -p "  اسم الدومين (مثال: halmanhaj.com): " DOMAIN
if [ -n "$DOMAIN" ]; then
  # نسخ وتعديل إعداد Nginx
  cp "$PROJECT_DIR/nginx.conf" "/etc/nginx/sites-available/halmanhaj"
  sed -i "s/yourdomain.com/$DOMAIN/g" "/etc/nginx/sites-available/halmanhaj"
  ln -sf /etc/nginx/sites-available/halmanhaj /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default

  # تعطيل SSL مؤقتاً (حتى نحصل على الشهادة)
  # سنستخدم Certbot لاحقاً
  echo -e "  ${GREEN}✓ Nginx معد للدومين: $DOMAIN${NC}"
fi

# ── SSL بـ Let's Encrypt ──
echo -e "\n${YELLOW}🔒 هل تريد تثبيت شهادة SSL مجانية (Let's Encrypt)? [y/N]${NC}"
read -r INSTALL_SSL
if [[ "$INSTALL_SSL" =~ ^[Yy]$ ]] && [ -n "$DOMAIN" ]; then
  apt install -y certbot python3-certbot-nginx
  certbot --nginx -d $DOMAIN -d www.$DOMAIN
  echo -e "  ${GREEN}✓ شهادة SSL مثبتة${NC}"
fi

# ── النشر الأول ──
echo -e "\n${YELLOW}🚀 تشغيل النشر الأول...${NC}"
cd $PROJECT_DIR
sudo -u $SUDO_USER bash deploy.sh

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}   ✅ تم إعداد السيرفر بنجاح!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${GREEN}🌐 الموقع: https://$DOMAIN${NC}"
echo -e "  ${GREEN}🔧 لوحة التحكم: https://$DOMAIN/admin/login${NC}"
echo ""
echo -e "  أوامر مفيدة:"
echo -e "  ${YELLOW}pm2 status${NC}              - حالة التطبيق"
echo -e "  ${YELLOW}pm2 logs halmanhaj${NC}      - السجلات"
echo -e "  ${YELLOW}cd $PROJECT_DIR && bash deploy.sh${NC} - نشر تحديث"
echo -e "  ${YELLOW}sudo nginx -t && sudo systemctl reload nginx${NC} - إعادة تحميل Nginx"
echo ""
