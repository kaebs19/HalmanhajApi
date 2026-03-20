const cron = require('node-cron');
const {
  sendDailyReminders,
  sendStreakReminders,
  sendAbsenceReminders,
} = require('./notificationService');

// ══════════════════════════════════════════
// تذكير يومي — كل ساعة (يتحقق من وقت التذكير لكل مستخدم)
// ══════════════════════════════════════════
cron.schedule('0 * * * *', async () => {
  console.log('⏰ تشغيل التذكيرات اليومية...');
  await sendDailyReminders();
});

// ══════════════════════════════════════════
// تذكير الـ Streak — الساعة 9 مساءً يومياً
// ══════════════════════════════════════════
cron.schedule('0 21 * * *', async () => {
  console.log('🔥 تشغيل تذكيرات السلسلة...');
  await sendStreakReminders();
});

// ══════════════════════════════════════════
// تذكير بعد الغياب — الساعة 5 مساءً يومياً
// ══════════════════════════════════════════
cron.schedule('0 17 * * *', async () => {
  console.log('👋 تشغيل تذكيرات الغياب...');
  await sendAbsenceReminders();
});

console.log('📅 Cron jobs للإشعارات مفعّلة');
