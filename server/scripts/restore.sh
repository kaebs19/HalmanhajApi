#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  استعادة نسخة احتياطية لحل المنهج
#
#  عرض النسخ المتاحة:      bash restore.sh list
#  استعادة قاعدة البيانات:  bash restore.sh db <اسم-الملف>
#  استعادة ملف/مجلد:        bash restore.sh file <المسار داخل uploads>
#
#  ⚠️ استعادة قاعدة البيانات تستبدل البيانات الحالية بالكامل.
#     السكربت يأخذ نسخة أمان قبلها تلقائياً ويطلب تأكيداً صريحاً.
# ═══════════════════════════════════════════════════════════
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/halmanhaj}"
DB_DIR="$BACKUP_ROOT/db"
FILES_DIR="$BACKUP_ROOT/files"

die() { echo "❌ $*"; exit 1; }

get_db_url() {
  local env_file="$PROJECT_DIR/server/.env"
  [ -f "$env_file" ] || die "لا يوجد ملف .env"
  grep -m1 '^DATABASE_URL=' "$env_file" | cut -d= -f2-
}

case "${1:-list}" in
  list)
    echo "═══ نسخ قاعدة البيانات ═══"
    ls -lh "$DB_DIR"/*.sql.gz 2>/dev/null | awk '{print "  "$9"  ("$5")  "$6" "$7}' || echo "  لا توجد نسخ"
    echo
    echo "═══ لقطات الملفات ═══"
    ls -1d "$FILES_DIR"/20* 2>/dev/null | while read -r d; do
      echo "  $(basename "$d")  ($(du -sh "$d" | cut -f1))"
    done || echo "  لا توجد لقطات"
    ;;

  db)
    FILE="${2:-}"
    [ -n "$FILE" ] || die "حدد اسم ملف النسخة. اعرض المتاح بـ: bash restore.sh list"
    [ -f "$FILE" ] || FILE="$DB_DIR/$FILE"
    [ -f "$FILE" ] || die "الملف غير موجود: $FILE"

    DB_URL=$(get_db_url)
    echo "⚠️  سيتم استبدال قاعدة البيانات الحالية بالكامل بمحتوى:"
    echo "    $FILE"
    read -r -p "اكتب 'نعم' للمتابعة: " confirm
    [ "$confirm" = "نعم" ] || die "أُلغيت العملية"

    SAFETY="$DB_DIR/before-restore-$(date +%Y-%m-%d-%H%M).sql.gz"
    echo "📦 نسخة أمان قبل الاستعادة: $SAFETY"
    pg_dump "$DB_URL" | gzip -6 > "$SAFETY" || die "فشلت نسخة الأمان — أُلغيت الاستعادة"

    echo "♻️  جاري الاستعادة..."
    gunzip -c "$FILE" | psql "$DB_URL" || die "فشلت الاستعادة (نسخة الأمان في $SAFETY)"
    echo "✅ تمت الاستعادة. أعد تشغيل التطبيق: pm2 restart halmanhaj"
    ;;

  file)
    REL="${2:-}"
    [ -n "$REL" ] || die "حدد المسار داخل uploads، مثال: tracks/123.png"
    SRC="$FILES_DIR/current/$REL"
    [ -e "$SRC" ] || die "غير موجود في النسخة: $SRC"

    DEST="$PROJECT_DIR/server/uploads/$REL"
    mkdir -p "$(dirname "$DEST")"
    cp -a "$SRC" "$DEST"
    echo "✅ استُعيد إلى $DEST"
    ;;

  *)
    die "أمر غير معروف. استخدم: list | db <ملف> | file <مسار>"
    ;;
esac
