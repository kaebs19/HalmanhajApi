const express = require('express');
const { pool } = require('../config/db');
const { optionalUserAuth, requireUserAuth } = require('../middleware/userAuth');
const { createUpload } = require('../middleware/upload');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const { sendPushNotification } = require('../services/pushNotification');

const router = express.Router();
const upload = createUpload('community');

// ═══════════════════════════════════════
// ضغط الصورة إلى 1 ميجا كحد أقصى
// ═══════════════════════════════════════
async function compressImage(filePath) {
  const maxSize = 1 * 1024 * 1024; // 1MB
  const stats = fs.statSync(filePath);

  if (stats.size <= maxSize) return;

  const ext = path.extname(filePath).toLowerCase();
  const tempPath = filePath + '.tmp';

  let quality = 80;
  let compressed = false;

  while (quality >= 10 && !compressed) {
    try {
      if (ext === '.png') {
        await sharp(filePath).png({ quality, compressionLevel: 9 }).toFile(tempPath);
      } else if (ext === '.webp') {
        await sharp(filePath).webp({ quality }).toFile(tempPath);
      } else {
        await sharp(filePath).jpeg({ quality }).toFile(tempPath);
      }

      const newStats = fs.statSync(tempPath);
      if (newStats.size <= maxSize) {
        fs.renameSync(tempPath, filePath);
        compressed = true;
      } else {
        fs.unlinkSync(tempPath);
        quality -= 15;
      }
    } catch {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      break;
    }
  }

  // إذا لم ينجح الضغط، نقلل الأبعاد
  if (!compressed) {
    try {
      const metadata = await sharp(filePath).metadata();
      const scale = Math.sqrt(maxSize / stats.size);
      const newWidth = Math.round((metadata.width || 800) * scale);

      await sharp(filePath)
        .resize(newWidth)
        .jpeg({ quality: 70 })
        .toFile(tempPath);

      fs.renameSync(tempPath, filePath);
    } catch {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }
}

// ═══════════════════════════════════════
// منح النقاط
// ═══════════════════════════════════════
const POINTS = {
  ASK_QUESTION: 2,
  ANSWER_QUESTION: 5,
  BEST_ANSWER: 15,
  RECEIVE_UPVOTE: 2,
  RECEIVE_DOWNVOTE: -1,
};

async function addPoints(userId, points) {
  if (!userId || !points) return;
  await pool.query('UPDATE users SET points = GREATEST(0, points + $1) WHERE id = $2', [points, userId]);
}

// ═══════════════════════════════════════
// عرض الأسئلة (عام) - موحد: أسئلة الأدمن + المجتمع
// ═══════════════════════════════════════
router.get('/questions', optionalUserAuth, async (req, res) => {
  try {
    const { stage_id, grade_id, subject_id, semester, sort = 'latest', page = 1, limit = 20, search, type } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];

    let query = `
      SELECT q.id, q.title, q.body, q.image_url, q.views, q.answers_count, q.is_closed,
        q.best_answer_id, q.semester, q.created_at,
        u.name as user_name, u.avatar_url as user_avatar, u.points as user_points,
        st.name as stage_name,
        g.name as grade_name,
        s.name as subject_name,
        'community' as question_type
      FROM community_questions q
      JOIN users u ON q.user_id = u.id
      LEFT JOIN stages st ON q.stage_id = st.id
      LEFT JOIN grades g ON q.grade_id = g.id
      LEFT JOIN subjects s ON q.subject_id = s.id
      WHERE q.is_published = true
    `;

    if (stage_id) {
      query += ` AND q.stage_id = $${params.length + 1}`;
      params.push(stage_id);
    }
    if (grade_id) {
      query += ` AND q.grade_id = $${params.length + 1}`;
      params.push(grade_id);
    }
    if (subject_id) {
      query += ` AND q.subject_id = $${params.length + 1}`;
      params.push(subject_id);
    }
    if (semester && semester !== '0') {
      query += ` AND (q.semester = $${params.length + 1} OR q.semester = 0)`;
      params.push(parseInt(semester));
    }
    if (search) {
      query += ` AND (q.title ILIKE $${params.length + 1} OR q.body ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    // فلاتر ترتيب خاصة
    if (sort === 'unanswered') {
      query += ' AND q.answers_count = 0';
    } else if (sort === 'solved') {
      query += ' AND q.best_answer_id IS NOT NULL';
    }

    // Count
    const countParams = [...params];
    const whereClause = query.substring(query.indexOf('WHERE'));
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM community_questions q JOIN users u ON q.user_id = u.id LEFT JOIN stages st ON q.stage_id = st.id LEFT JOIN grades g ON q.grade_id = g.id LEFT JOIN subjects s ON q.subject_id = s.id ${whereClause}`,
      countParams
    );
    let communityTotal = parseInt(countResult.rows[0].total);

    // ترتيب
    if (sort === 'popular') {
      query += ' ORDER BY q.views DESC, q.created_at DESC';
    } else {
      query += ' ORDER BY q.created_at DESC';
    }

    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const communityResult = await pool.query(query, params);

    // جلب أسئلة الأدمن (FAQs) إذا لم يكن الفلتر خاص بنوع community فقط
    let faqRows = [];
    if (type !== 'community') {
      let faqQuery = `
        SELECT f.id, f.question as title, f.answer as body, NULL as image_url, 0 as views, 0 as answers_count, false as is_closed,
          NULL as best_answer_id, f.semester, f.created_at,
          'المشرف' as user_name, NULL as user_avatar, 0 as user_points,
          st.name as stage_name,
          g.name as grade_name,
          s.name as subject_name,
          'admin' as question_type
        FROM faqs f
        LEFT JOIN grades g ON f.grade_id = g.id
        LEFT JOIN subjects s ON f.subject_id = s.id
        LEFT JOIN stages st ON g.stage_id = st.id
        WHERE f.is_published = true
      `;
      const faqParams = [];
      if (grade_id) {
        faqQuery += ` AND f.grade_id = $${faqParams.length + 1}`;
        faqParams.push(grade_id);
      }
      if (subject_id) {
        faqQuery += ` AND f.subject_id = $${faqParams.length + 1}`;
        faqParams.push(subject_id);
      }
      if (search) {
        faqQuery += ` AND (f.question ILIKE $${faqParams.length + 1} OR f.answer ILIKE $${faqParams.length + 1})`;
        faqParams.push(`%${search}%`);
      }
      faqQuery += ' ORDER BY f.sort_order ASC, f.created_at DESC';

      const faqResult = await pool.query(faqQuery, faqParams);
      faqRows = faqResult.rows;
    }

    // دمج النتائج: أسئلة الأدمن أولاً في الصفحة الأولى فقط
    let allQuestions;
    if (parseInt(page) === 1 && type !== 'community') {
      allQuestions = [...faqRows, ...communityResult.rows];
    } else {
      allQuestions = communityResult.rows;
    }

    const total = communityTotal + (type !== 'community' ? faqRows.length : 0);

    res.json({
      questions: allQuestions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(communityTotal / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('خطأ في جلب الأسئلة:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// عرض سؤال واحد مع الإجابات
// ═══════════════════════════════════════
router.get('/questions/:id', optionalUserAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const question = await pool.query(`
      SELECT q.*,
        u.name as user_name, u.avatar_url as user_avatar, u.points as user_points, u.id as user_id,
        st.name as stage_name,
        g.name as grade_name,
        s.name as subject_name
      FROM community_questions q
      JOIN users u ON q.user_id = u.id
      LEFT JOIN stages st ON q.stage_id = st.id
      LEFT JOIN grades g ON q.grade_id = g.id
      LEFT JOIN subjects s ON q.subject_id = s.id
      WHERE q.id = $1 AND q.is_published = true
    `, [id]);

    if (question.rowCount === 0) {
      return res.status(404).json({ message: 'السؤال غير موجود' });
    }

    // زيادة المشاهدات
    await pool.query('UPDATE community_questions SET views = views + 1 WHERE id = $1', [id]);

    // جلب الإجابات مع بيانات المستخدم والتصويت
    let answersQuery = `
      SELECT a.*,
        u.name as user_name, u.avatar_url as user_avatar, u.points as user_points, u.id as user_id
      FROM community_answers a
      JOIN users u ON a.user_id = u.id
      WHERE a.question_id = $1
      ORDER BY a.is_best DESC, (a.upvotes - a.downvotes) DESC, a.created_at ASC
    `;

    const answers = await pool.query(answersQuery, [id]);

    // إذا كان المستخدم مسجل، نجلب تصويتاته
    let userVotes = {};
    if (req.user) {
      const votes = await pool.query(
        'SELECT answer_id, vote_type FROM answer_votes WHERE user_id = $1 AND answer_id = ANY($2)',
        [req.user.id, answers.rows.map(a => a.id)]
      );
      votes.rows.forEach(v => { userVotes[v.answer_id] = v.vote_type; });
    }

    const answersWithVotes = answers.rows.map(a => ({
      ...a,
      user_vote: userVotes[a.id] || 0
    }));

    res.json({
      question: { ...question.rows[0], views: question.rows[0].views + 1 },
      answers: answersWithVotes
    });
  } catch (err) {
    console.error('خطأ في جلب السؤال:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// إضافة سؤال (مستخدم مسجل) - مع صورة
// ═══════════════════════════════════════
router.post('/questions', requireUserAuth, upload.single('image'), async (req, res) => {
  try {
    const { title, body, stage_id, grade_id, subject_id, semester } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'عنوان السؤال مطلوب' });
    }

    let imageUrl = null;
    if (req.file) {
      await compressImage(req.file.path);
      imageUrl = `/uploads/community/${req.file.filename}`;
    }

    const result = await pool.query(
      `INSERT INTO community_questions (user_id, title, body, stage_id, grade_id, subject_id, semester, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        req.user.id,
        title.trim(),
        body?.trim() || null,
        stage_id || null,
        grade_id || null,
        subject_id || null,
        semester || 0,
        imageUrl
      ]
    );

    // منح نقاط على طرح سؤال
    await addPoints(req.user.id, POINTS.ASK_QUESTION);
    // تحديث نشاط المستخدم
    await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [req.user.id]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('خطأ في إنشاء سؤال:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// إضافة إجابة (مستخدم مسجل) - مع صورة
// ═══════════════════════════════════════
router.post('/questions/:id/answers', requireUserAuth, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { body } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({ message: 'الإجابة مطلوبة' });
    }

    // التأكد من وجود السؤال
    const question = await pool.query(
      'SELECT id, user_id, title, is_closed FROM community_questions WHERE id = $1 AND is_published = true',
      [id]
    );
    if (question.rowCount === 0) {
      return res.status(404).json({ message: 'السؤال غير موجود' });
    }
    if (question.rows[0].is_closed) {
      return res.status(400).json({ message: 'هذا السؤال مغلق' });
    }

    let imageUrl = null;
    if (req.file) {
      await compressImage(req.file.path);
      imageUrl = `/uploads/community/${req.file.filename}`;
    }

    const result = await pool.query(
      `INSERT INTO community_answers (question_id, user_id, body, image_url)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, req.user.id, body.trim(), imageUrl]
    );

    // تحديث عدد الإجابات
    await pool.query(
      'UPDATE community_questions SET answers_count = answers_count + 1, updated_at = NOW() WHERE id = $1',
      [id]
    );

    // منح نقاط على الإجابة
    await addPoints(req.user.id, POINTS.ANSWER_QUESTION);
    await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [req.user.id]);

    // إرسال إشعار لصاحب السؤال
    if (question.rows[0].user_id !== req.user.id) {
      sendPushNotification(question.rows[0].user_id, {
        type: 'new_answer',
        title: 'إجابة جديدة على سؤالك 💬',
        body: 'قام أحدهم بالإجابة على سؤالك',
        refType: 'question',
        refId: id
      });
    }

    // جلب بيانات المستخدم
    const user = await pool.query('SELECT name, avatar_url, points FROM users WHERE id = $1', [req.user.id]);

    res.status(201).json({
      ...result.rows[0],
      user_name: user.rows[0]?.name,
      user_avatar: user.rows[0]?.avatar_url,
      user_points: user.rows[0]?.points,
      user_vote: 0
    });
  } catch (err) {
    console.error('خطأ في إنشاء إجابة:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// التصويت على إجابة (مستخدم مسجل)
// ═══════════════════════════════════════
router.post('/answers/:id/vote', requireUserAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { vote_type } = req.body; // 1 = up, -1 = down

    if (![1, -1].includes(vote_type)) {
      return res.status(400).json({ message: 'نوع التصويت غير صالح' });
    }

    // التأكد من وجود الإجابة
    const answer = await pool.query('SELECT id, user_id FROM community_answers WHERE id = $1', [id]);
    if (answer.rowCount === 0) {
      return res.status(404).json({ message: 'الإجابة غير موجودة' });
    }

    // لا يمكن التصويت على إجابتك
    if (answer.rows[0].user_id === req.user.id) {
      return res.status(400).json({ message: 'لا يمكنك التصويت على إجابتك' });
    }

    const answererUserId = answer.rows[0].user_id;

    // التحقق من تصويت سابق
    const existingVote = await pool.query(
      'SELECT id, vote_type FROM answer_votes WHERE answer_id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (existingVote.rowCount > 0) {
      if (existingVote.rows[0].vote_type === vote_type) {
        // إلغاء التصويت
        await pool.query('DELETE FROM answer_votes WHERE id = $1', [existingVote.rows[0].id]);
        if (vote_type === 1) {
          await pool.query('UPDATE community_answers SET upvotes = upvotes - 1 WHERE id = $1', [id]);
          await addPoints(answererUserId, -POINTS.RECEIVE_UPVOTE);
        } else {
          await pool.query('UPDATE community_answers SET downvotes = downvotes - 1 WHERE id = $1', [id]);
          await addPoints(answererUserId, -POINTS.RECEIVE_DOWNVOTE);
        }
        return res.json({ vote: 0, message: 'تم إلغاء التصويت' });
      } else {
        // تغيير التصويت
        await pool.query('UPDATE answer_votes SET vote_type = $1 WHERE id = $2', [vote_type, existingVote.rows[0].id]);
        if (vote_type === 1) {
          await pool.query('UPDATE community_answers SET upvotes = upvotes + 1, downvotes = downvotes - 1 WHERE id = $1', [id]);
          await addPoints(answererUserId, POINTS.RECEIVE_UPVOTE - POINTS.RECEIVE_DOWNVOTE);
        } else {
          await pool.query('UPDATE community_answers SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE id = $1', [id]);
          await addPoints(answererUserId, POINTS.RECEIVE_DOWNVOTE - POINTS.RECEIVE_UPVOTE);
        }
        return res.json({ vote: vote_type, message: 'تم تغيير التصويت' });
      }
    }

    // تصويت جديد
    await pool.query(
      'INSERT INTO answer_votes (answer_id, user_id, vote_type) VALUES ($1, $2, $3)',
      [id, req.user.id, vote_type]
    );

    if (vote_type === 1) {
      await pool.query('UPDATE community_answers SET upvotes = upvotes + 1 WHERE id = $1', [id]);
      await addPoints(answererUserId, POINTS.RECEIVE_UPVOTE);
    } else {
      await pool.query('UPDATE community_answers SET downvotes = downvotes + 1 WHERE id = $1', [id]);
      await addPoints(answererUserId, POINTS.RECEIVE_DOWNVOTE);
    }

    res.json({ vote: vote_type, message: 'تم التصويت' });
  } catch (err) {
    console.error('خطأ في التصويت:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ═══════════════════════════════════════
// اختيار أفضل إجابة (صاحب السؤال فقط)
// ═══════════════════════════════════════
router.post('/answers/:id/best', requireUserAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // جلب الإجابة والسؤال
    const answer = await pool.query(
      `SELECT a.id, a.question_id, a.user_id as answer_user_id, q.user_id as question_owner_id, q.best_answer_id
       FROM community_answers a
       JOIN community_questions q ON a.question_id = q.id
       WHERE a.id = $1`,
      [id]
    );

    if (answer.rowCount === 0) {
      return res.status(404).json({ message: 'الإجابة غير موجودة' });
    }

    // فقط صاحب السؤال يمكنه اختيار أفضل إجابة
    if (answer.rows[0].question_owner_id !== req.user.id) {
      return res.status(403).json({ message: 'فقط صاحب السؤال يمكنه اختيار أفضل إجابة' });
    }

    const questionId = answer.rows[0].question_id;
    const oldBestAnswerId = answer.rows[0].best_answer_id;

    // إزالة نقاط أفضل إجابة السابقة
    if (oldBestAnswerId) {
      const oldBest = await pool.query('SELECT user_id FROM community_answers WHERE id = $1', [oldBestAnswerId]);
      if (oldBest.rowCount > 0) {
        await addPoints(oldBest.rows[0].user_id, -POINTS.BEST_ANSWER);
      }
    }

    // إزالة أفضل إجابة سابقة
    await pool.query(
      'UPDATE community_answers SET is_best = false WHERE question_id = $1',
      [questionId]
    );

    // تعيين الإجابة الجديدة كأفضل
    await pool.query(
      'UPDATE community_answers SET is_best = true WHERE id = $1',
      [id]
    );

    // تحديث السؤال
    await pool.query(
      'UPDATE community_questions SET best_answer_id = $1 WHERE id = $2',
      [id, questionId]
    );

    // منح نقاط أفضل إجابة
    await addPoints(answer.rows[0].answer_user_id, POINTS.BEST_ANSWER);

    // إشعار صاحب الإجابة
    if (answer.rows[0].answer_user_id !== req.user.id) {
      sendPushNotification(answer.rows[0].answer_user_id, {
        type: 'best_answer',
        title: 'تم اختيار إجابتك كأفضل إجابة ⭐',
        body: 'أحسنت! إجابتك هي الأفضل',
        refType: 'question',
        refId: answer.rows[0].question_id
      });
    }

    res.json({ message: 'تم اختيار أفضل إجابة' });
  } catch (err) {
    console.error('خطأ في اختيار أفضل إجابة:', err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
