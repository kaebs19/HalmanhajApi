#!/bin/bash
# ===================================
# سكربت نشر حل المنهج - HalManhaj Deploy
# ===================================
# الاستخدام: bash deploy.sh

set -e

# ── الألوان ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   🚀 نشر حل المنهج - HalManhaj${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# المسار الرئيسي للمشروع
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# ── 1. سحب آخر التحديثات ──
echo -e "\n${YELLOW}📥 [1/6] سحب التحديثات من GitHub...${NC}"
git pull origin main

# ── 2. تثبيت حزم السيرفر ──
echo -e "\n${YELLOW}📦 [2/6] تثبيت حزم السيرفر...${NC}"
cd server
npm install --production
cd ..

# ── 3. تثبيت حزم الكلاينت وبناء React ──
echo -e "\n${YELLOW}🔨 [3/6] بناء واجهة React...${NC}"
cd client
npm install --legacy-peer-deps
npm run build
cd ..

# ── 4. إنشاء مجلدات الرفع إذا لم تكن موجودة ──
echo -e "\n${YELLOW}📂 [4/6] التحقق من مجلدات الرفع...${NC}"
UPLOAD_DIRS=(
  "server/uploads/lessons"
  "server/uploads/thumbnails"
  "server/uploads/previews"
  "server/uploads/subjects"
  "server/uploads/settings"
  "server/uploads/community"
  "server/uploads/grades"
  "server/uploads/pdf-tools"
)

for dir in "${UPLOAD_DIRS[@]}"; do
  mkdir -p "$dir"
  echo -e "  ✓ $dir"
done

# ── 5. إنشاء مجلد السجلات ──
mkdir -p logs

# ── 6. إعادة تشغيل التطبيق ──
echo -e "\n${YELLOW}🔄 [5/6] إعادة تشغيل التطبيق...${NC}"
if command -v pm2 &> /dev/null; then
  # إذا PM2 مثبت
  if pm2 list | grep -q "halmanhaj"; then
    pm2 restart halmanhaj
    echo -e "  ${GREEN}✓ تم إعادة تشغيل halmanhaj${NC}"
  else
    pm2 start ecosystem.config.js
    pm2 save
    echo -e "  ${GREEN}✓ تم تشغيل halmanhaj لأول مرة${NC}"
  fi
else
  echo -e "  ${RED}⚠ PM2 غير مثبت! ثبته بالأمر: npm install -g pm2${NC}"
  echo -e "  ${YELLOW}يمكنك تشغيل السيرفر يدوياً: cd server && NODE_ENV=production node index.js${NC}"
fi

# ── 6. التحقق من الحالة ──
echo -e "\n${YELLOW}✅ [6/6] التحقق من حالة التطبيق...${NC}"
sleep 2

# فحص Health Check
if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
  HEALTH=$(curl -s http://localhost:5000/api/health)
  echo -e "  ${GREEN}✓ السيرفر يعمل بنجاح!${NC}"
  echo -e "  ${GREEN}  $HEALTH${NC}"
else
  echo -e "  ${YELLOW}⏳ السيرفر يبدأ... انتظر ثواني وتحقق بالأمر:${NC}"
  echo -e "  ${YELLOW}  curl http://localhost:5000/api/health${NC}"
fi

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}   ✅ تم النشر بنجاح!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e ""
echo -e "  أوامر مفيدة:"
echo -e "  ${YELLOW}pm2 status${NC}          - حالة التطبيق"
echo -e "  ${YELLOW}pm2 logs halmanhaj${NC}  - السجلات المباشرة"
echo -e "  ${YELLOW}pm2 restart halmanhaj${NC} - إعادة تشغيل"
echo -e ""
