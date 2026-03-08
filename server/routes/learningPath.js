const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { requireUserAuth } = require('../middleware/userAuth');

const router = express.Router();

// ═══════════════════════════════════════
// Middleware: يقبل admin أو student
// ═══════════════════════════════════════
const requireAnyAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'يجب تسجيل الدخول' });
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === 'user') {
      req.user = decoded;
    } else {
      req.admin = decoded;
    }
    next();
  } catch {
    return res.status(401).json({ message: 'رمز غير صالح' });
  }
};


// ═══════════════════════════════════════════════════════
//                    مسارات الأدمن
// ═══════════════════════════════════════════════════════

// 1. إنشاء مسار تعلم
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { subject_id, grade_id, title, description } = req.body;
    if (!subject_id || !grade_id || !title) {
      return res.status(400).json({ message: 'المادة والصف والعنوان مطلوبة' });
    }

    const result = await pool.query(`
      INSERT INTO learning_paths (subject_id, grade_id, title, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [subject_id, grade_id, title, description || null]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'يوجد مسار بالفعل لهذه المادة والصف' });
    }
    console.error('POST /learning-paths error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// 2. إضافة محطة (node) إلى المسار
router.post('/:pathId/nodes', authMiddleware, async (req, res) => {
  try {
    const { pathId } = req.params;
    const { exercise_id, node_type, order_index, required_xp, unlock_after_node_id } = req.body;

    if (!exercise_id) {
      return res.status(400).json({ message: 'التمرين مطلوب' });
    }

    // تحقق من وجود المسار
    const pathCheck = await pool.query('SELECT id FROM learning_paths WHERE id = $1', [pathId]);
    if (pathCheck.rowCount === 0) {
      return res.status(404).json({ message: 'المسار غير موجود' });
    }

    // حساب order_index تلقائي إذا لم يُعطَ
    let finalOrder = order_index;
    if (finalOrder === undefined || finalOrder === null) {
      const maxOrder = await pool.query(
        'SELECT COALESCE(MAX(order_index), -1) + 1 as next_order FROM learning_path_nodes WHERE path_id = $1',
        [pathId]
      );
      finalOrder = maxOrder.rows[0].next_order;
    }

    const result = await pool.query(`
      INSERT INTO learning_path_nodes (path_id, exercise_id, node_type, order_index, required_xp, unlock_after_node_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      pathId,
      exercise_id,
      node_type || 'exercise',
      finalOrder,
      required_xp || 0,
      unlock_after_node_id || null
    ]);

    // جلب عنوان التمرين
    const exerciseInfo = await pool.query('SELECT title, type FROM exercises WHERE id = $1', [exercise_id]);
    const node = result.rows[0];
    if (exerciseInfo.rowCount > 0) {
      node.exercise_title = exerciseInfo.rows[0].title;
      node.exercise_type = exerciseInfo.rows[0].type;
    }

    res.status(201).json(node);
  } catch (err) {
    console.error('POST /learning-paths/:pathId/nodes error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// 3. عرض المسار مع المحطات (أدمن)
router.get('/admin/:subjectId/:gradeId', authMiddleware, async (req, res) => {
  try {
    const { subjectId, gradeId } = req.params;

    // جلب المسار
    const pathResult = await pool.query(
      'SELECT * FROM learning_paths WHERE subject_id = $1 AND grade_id = $2',
      [subjectId, gradeId]
    );
    if (pathResult.rowCount === 0) {
      return res.json({ path: null, nodes: [] });
    }

    const path = pathResult.rows[0];

    // جلب المحطات مع بيانات التمارين
    const nodesResult = await pool.query(`
      SELECT lpn.*, e.title as exercise_title, e.type as exercise_type, e.xp_reward, e.difficulty,
        (SELECT COUNT(*) FROM exercise_questions WHERE exercise_id = e.id) as questions_count
      FROM learning_path_nodes lpn
      LEFT JOIN exercises e ON e.id = lpn.exercise_id
      WHERE lpn.path_id = $1
      ORDER BY lpn.order_index
    `, [path.id]);

    res.json({ path, nodes: nodesResult.rows });
  } catch (err) {
    console.error('GET /learning-paths/admin/:subjectId/:gradeId error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// 4. تعديل محطة
router.put('/nodes/:nodeId', authMiddleware, async (req, res) => {
  try {
    const { nodeId } = req.params;
    const { order_index, required_xp, node_type, unlock_after_node_id, exercise_id } = req.body;

    const result = await pool.query(`
      UPDATE learning_path_nodes SET
        order_index = COALESCE($1, order_index),
        required_xp = COALESCE($2, required_xp),
        node_type = COALESCE($3, node_type),
        unlock_after_node_id = $4,
        exercise_id = COALESCE($6, exercise_id)
      WHERE id = $5
      RETURNING *
    `, [order_index, required_xp, node_type, unlock_after_node_id || null, nodeId, exercise_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'المحطة غير موجودة' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /learning-paths/nodes/:nodeId error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// 5. حذف محطة
router.delete('/nodes/:nodeId', authMiddleware, async (req, res) => {
  try {
    const { nodeId } = req.params;

    // تنظيف مراجع unlock_after_node_id
    await pool.query(
      'UPDATE learning_path_nodes SET unlock_after_node_id = NULL WHERE unlock_after_node_id = $1',
      [nodeId]
    );

    const result = await pool.query('DELETE FROM learning_path_nodes WHERE id = $1 RETURNING id', [nodeId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'المحطة غير موجودة' });
    }

    res.json({ message: 'تم حذف المحطة' });
  } catch (err) {
    console.error('DELETE /learning-paths/nodes/:nodeId error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});


// ═══════════════════════════════════════════════════════
//                    مسارات الطالب
// ═══════════════════════════════════════════════════════

// 6. عرض المسار + حالة كل محطة (للطالب)
router.get('/:subjectId', requireUserAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { subjectId } = req.params;

    // جلب grade_id من ملف الطالب
    const userResult = await pool.query('SELECT grade_id FROM users WHERE id = $1', [userId]);
    const gradeId = userResult.rows[0]?.grade_id;
    if (!gradeId) {
      return res.status(400).json({ message: 'لم يتم تحديد صفك الدراسي' });
    }

    // جلب المسار
    const pathResult = await pool.query(
      'SELECT * FROM learning_paths WHERE subject_id = $1 AND grade_id = $2 AND is_active = true',
      [subjectId, gradeId]
    );
    if (pathResult.rowCount === 0) {
      return res.json({ path: null, nodes: [], progress: null });
    }

    const path = pathResult.rows[0];

    // جلب المحطات مع بيانات التمارين
    const nodesResult = await pool.query(`
      SELECT lpn.id, lpn.exercise_id, lpn.node_type, lpn.order_index, lpn.required_xp, lpn.unlock_after_node_id,
        e.title as exercise_title, e.type as exercise_type, e.xp_reward, e.difficulty,
        (SELECT COUNT(*) FROM exercise_questions WHERE exercise_id = e.id) as questions_count
      FROM learning_path_nodes lpn
      LEFT JOIN exercises e ON e.id = lpn.exercise_id
      WHERE lpn.path_id = $1
      ORDER BY lpn.order_index
    `, [path.id]);

    const nodes = nodesResult.rows;

    // جلب أو إنشاء تقدم الطالب
    let progressResult = await pool.query(
      'SELECT * FROM student_path_progress WHERE user_id = $1 AND path_id = $2',
      [userId, path.id]
    );

    let progress;
    if (progressResult.rowCount === 0) {
      // إنشاء سجل تقدم جديد — المحطة الأولى هي الحالية
      const firstNodeId = nodes.length > 0 ? nodes[0].id : null;
      const insertResult = await pool.query(`
        INSERT INTO student_path_progress (user_id, path_id, current_node_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, path_id) DO NOTHING
        RETURNING *
      `, [userId, path.id, firstNodeId]);

      if (insertResult.rowCount > 0) {
        progress = insertResult.rows[0];
      } else {
        progressResult = await pool.query(
          'SELECT * FROM student_path_progress WHERE user_id = $1 AND path_id = $2',
          [userId, path.id]
        );
        progress = progressResult.rows[0];
      }
    } else {
      progress = progressResult.rows[0];
    }

    const completedIds = progress.completed_node_ids || [];
    const currentNodeId = progress.current_node_id;
    const totalXp = progress.total_xp_earned || 0;

    // حساب حالة كل محطة
    const nodesWithStatus = nodes.map(node => {
      let status;
      if (completedIds.includes(node.id)) {
        status = 'completed';
      } else if (node.id === currentNodeId) {
        status = 'current';
      } else {
        const prerequisiteMet = !node.unlock_after_node_id || completedIds.includes(node.unlock_after_node_id);
        const xpMet = totalXp >= (node.required_xp || 0);
        status = (prerequisiteMet && xpMet) ? 'available' : 'locked';
      }
      return { ...node, status };
    });

    // نسبة الإنجاز
    const completionPct = nodes.length > 0
      ? Math.round((completedIds.length / nodes.length) * 100)
      : 0;

    res.json({
      path,
      nodes: nodesWithStatus,
      progress: {
        current_node_id: currentNodeId,
        completed_count: completedIds.length,
        total_nodes: nodes.length,
        completion_percentage: completionPct,
        total_xp_earned: totalXp,
      },
    });
  } catch (err) {
    console.error('GET /learning-paths/:subjectId error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// 7. إكمال محطة
router.post('/complete-node', requireUserAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { node_id } = req.body;

    if (!node_id) {
      return res.status(400).json({ message: 'معرف المحطة مطلوب' });
    }

    // جلب المحطة
    const nodeResult = await pool.query(
      'SELECT * FROM learning_path_nodes WHERE id = $1',
      [node_id]
    );
    if (nodeResult.rowCount === 0) {
      return res.status(404).json({ message: 'المحطة غير موجودة' });
    }
    const node = nodeResult.rows[0];

    // جلب تقدم الطالب
    const progressResult = await pool.query(
      'SELECT * FROM student_path_progress WHERE user_id = $1 AND path_id = $2',
      [userId, node.path_id]
    );
    if (progressResult.rowCount === 0) {
      return res.status(400).json({ message: 'لم تبدأ هذا المسار بعد' });
    }
    const progress = progressResult.rows[0];
    const completedIds = progress.completed_node_ids || [];

    // تحقق أن المحطة لم تُكمل بالفعل
    if (completedIds.includes(node_id)) {
      return res.status(400).json({ message: 'هذه المحطة مكتملة بالفعل' });
    }

    // تحقق أن المحطة current أو available
    const isCurrentOrAvailable =
      node_id === progress.current_node_id ||
      (
        (!node.unlock_after_node_id || completedIds.includes(node.unlock_after_node_id)) &&
        (progress.total_xp_earned >= (node.required_xp || 0))
      );

    if (!isCurrentOrAvailable) {
      return res.status(400).json({ message: 'هذه المحطة مقفلة' });
    }

    // حساب XP المكتسب من التمرين
    let xpEarned = 0;
    if (node.exercise_id) {
      const xpResult = await pool.query(
        'SELECT xp_reward FROM exercises WHERE id = $1',
        [node.exercise_id]
      );
      if (xpResult.rowCount > 0) {
        xpEarned = xpResult.rows[0].xp_reward || 0;
      }
    }

    // ابحث عن المحطة التالية
    const nextNodeResult = await pool.query(
      'SELECT id FROM learning_path_nodes WHERE path_id = $1 AND order_index > $2 ORDER BY order_index LIMIT 1',
      [node.path_id, node.order_index]
    );
    const nextNodeId = nextNodeResult.rowCount > 0 ? nextNodeResult.rows[0].id : null;

    // تحديث التقدم
    await pool.query(`
      UPDATE student_path_progress SET
        completed_node_ids = array_append(completed_node_ids, $1::uuid),
        current_node_id = $2,
        total_xp_earned = total_xp_earned + $3,
        updated_at = NOW()
      WHERE user_id = $4 AND path_id = $5
    `, [node_id, nextNodeId, xpEarned, userId, node.path_id]);

    // هل المسار مكتمل؟
    const totalNodes = await pool.query(
      'SELECT COUNT(*) as cnt FROM learning_path_nodes WHERE path_id = $1',
      [node.path_id]
    );
    const totalCount = parseInt(totalNodes.rows[0].cnt);
    const pathComplete = (completedIds.length + 1) >= totalCount;

    res.json({
      message: pathComplete ? 'تم إكمال المسار بالكامل! 🎉' : 'تم إكمال المحطة',
      next_node_id: nextNodeId,
      path_complete: pathComplete,
      xp_earned: xpEarned,
      total_xp: (progress.total_xp_earned || 0) + xpEarned,
      completed_count: completedIds.length + 1,
      total_nodes: totalCount,
    });
  } catch (err) {
    console.error('POST /learning-paths/complete-node error:', err.message);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});


module.exports = router;
