#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  نسخ احتياطي لحل المنهج
#  الاستخدام:
#    bash backup.sh db      → نسخة قاعدة البيانات (يومياً)
#    bash backup.sh files   → نسخة الملفات الأصلية (أسبوعياً)
#    bash backup.sh all     → الاثنان معاً
#
#  الوجهة الخارجية اختيارية: ضعها في /etc/halmanhaj-backup.conf
#    REMOTE_DEST="user@host:/path"    (أي وجهة يفهمها rsync)
#  وبدونها تبقى النسخ محلية فقط.
# ═══════════════════════════════════════════════════════════
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/halmanhaj}"
DB_DIR="$BACKUP_ROOT/db"
FILES_DIR="$BACKUP_ROOT/files"
LOG_FILE="${LOG_FILE:-/var/log/halmanhaj-backup.log}"

KEEP_DB_DAYS=30        # كم يوماً نحتفظ بنسخ قاعدة البيانات
KEEP_SNAPSHOTS=4       # كم لقطة أسبوعية للملفات

# الوجهة الخارجية (اختيارية)
REMOTE_DEST=""
[ -f /etc/halmanhaj-backup.conf ] && . /etc/halmanhaj-backup.conf

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
die() { log "❌ خطأ: $*"; exit 1; }

mkdir -p "$DB_DIR" "$FILES_DIR" "$(dirname "$LOG_FILE")"

# ── قاعدة البيانات ──────────────────────────────────────────
backup_db() {
  local env_file="$PROJECT_DIR/server/.env"
  [ -f "$env_file" ] || die "لا يوجد ملف .env في $env_file"

  local db_url
  db_url=$(grep -m1 '^DATABASE_URL=' "$env_file" | cut -d= -f2-)
  [ -n "$db_url" ] || die "DATABASE_URL غير موجود في .env"

  local out="$DB_DIR/halmanhaj-$(date +%Y-%m-%d-%H%M).sql.gz"
  log "📦 بدء نسخ قاعدة البيانات..."

  # النسخ لملف مؤقت أولاً حتى لا تبقى نسخة ناقصة عند الفشل
  pg_dump "$db_url" | gzip -6 > "$out.tmp" || die "فشل pg_dump"

  # التحقق من سلامة الأرشيف قبل اعتماده
  gzip -t "$out.tmp" || die "الأرشيف تالف"

  local size
  size=$(stat -c %s "$out.tmp" 2>/dev/null || stat -f %z "$out.tmp")
  [ "$size" -gt 51200 ] || die "حجم النسخة صغير بشكل مريب ($size بايت)"

  mv "$out.tmp" "$out"
  log "✅ قاعدة البيانات: $(basename "$out") ($((size / 1024)) كيلوبايت)"

  # حذف النسخ الأقدم من المدة المحددة
  local deleted
  deleted=$(find "$DB_DIR" -name 'halmanhaj-*.sql.gz' -mtime "+$KEEP_DB_DAYS" -print -delete | wc -l)
  [ "$deleted" -gt 0 ] && log "🧹 حُذفت $deleted نسخة أقدم من $KEEP_DB_DAYS يوماً"

  return 0
}

# ── الملفات ────────────────────────────────────────────────
# نستثني المجلدات المشتقة: صفحات PDF المحوّلة والصور المصغرة
# يمكن إعادة توليدها من الملفات الأصلية، ونسخها يضاعف الحجم بلا فائدة.
backup_files() {
  local src="$PROJECT_DIR/server/uploads"
  [ -d "$src" ] || die "مجلد الرفع غير موجود: $src"

  local current="$FILES_DIR/current"
  local snapshot="$FILES_DIR/$(date +%Y-%m-%d)"

  log "📂 بدء مزامنة الملفات الأصلية..."

  # --link-dest يجعل اللقطة الجديدة تشارك الملفات غير المتغيرة عبر hard links،
  # فلا تستهلك مساحة إضافية تُذكر (ملفات الدروس لا تتغير بعد رفعها).
  rsync -a --delete \
    --exclude 'pages/' \
    --exclude 'thumbnails/' \
    --exclude 'previews/' \
    --exclude 'ai-temp/' \
    --exclude 'pdf-tools/' \
    --exclude '.tus-completed/' \
    --exclude '*.json.tmp' \
    "$src/" "$current/" || die "فشل rsync المحلي"

  # لقطة مؤرخة بروابط صلبة
  if [ ! -d "$snapshot" ]; then
    cp -al "$current" "$snapshot" 2>/dev/null || rsync -a --link-dest="$current" "$current/" "$snapshot/"
  fi

  local size
  size=$(du -sh "$current" | cut -f1)
  log "✅ الملفات: $size في $current (لقطة: $(basename "$snapshot"))"

  # الإبقاء على آخر N لقطات فقط
  local old
  old=$(ls -1d "$FILES_DIR"/20* 2>/dev/null | sort -r | tail -n +$((KEEP_SNAPSHOTS + 1)) || true)
  if [ -n "$old" ]; then
    echo "$old" | while read -r d; do rm -rf "$d"; log "🧹 حُذفت اللقطة $(basename "$d")"; done
  fi

  return 0
}

# ── الإرسال لوجهة خارجية ────────────────────────────────────
sync_remote() {
  if [ -z "$REMOTE_DEST" ]; then
    log "ℹ️  لا توجد وجهة خارجية — النسخ محلية فقط."
    log "    لتفعيلها: ضع REMOTE_DEST=\"user@host:/path\" في /etc/halmanhaj-backup.conf"
    return 0
  fi

  log "☁️  إرسال النسخ إلى $REMOTE_DEST ..."
  rsync -az --delete "$BACKUP_ROOT/" "$REMOTE_DEST/" \
    && log "✅ اكتمل الإرسال للوجهة الخارجية" \
    || log "⚠️ فشل الإرسال للوجهة الخارجية — النسخ المحلية سليمة"
}

# ── التشغيل ────────────────────────────────────────────────
MODE="${1:-all}"
log "═══ بدء النسخ الاحتياطي ($MODE) ═══"

case "$MODE" in
  db)    backup_db ;;
  files) backup_files ;;
  all)   backup_db; backup_files ;;
  *)     die "وضع غير معروف: $MODE (استخدم db أو files أو all)" ;;
esac

sync_remote

log "═══ انتهى ($(df -h / | tail -1 | awk '{print "حر: "$4}')) ═══"
