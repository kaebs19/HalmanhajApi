const express = require('express');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { createUpload } = require('../middleware/upload');

const upload = createUpload('tracks');
const router = express.Router();

router.use(authMiddleware);

function generateSlug(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u0621-\u064Aa-z0-9-]/g, '')
    .substring(0, 100) + '-' + Date.now();
}

// GET /api/tracks
router.get('/', async (req, res) => {
  try {
    const { stage_id } = req.query;
    let query = 'SELECT t.*, s.name as stage_name FROM tracks t JOIN stages s ON t.stage_id = s.id';
    const params = [];

    if (stage_id) {
      query += ' WHERE t.stage_id = $1';
      params.push(stage_id);
    }

    query += ' ORDER BY t.stage_id, t.sort_order ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// POST /api/tracks
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, stage_id, icon } = req.body;
    if (!name || !stage_id) {
      return res.status(400).json({ message: 'اسم المسار والمرحلة مطلوبان' });
    }

    const stageExists = await pool.query('SELECT id FROM stages WHERE id = $1', [stage_id]);
    if (stageExists.rowCount === 0) {
      return res.status(400).json({ message: 'المرحلة غير موجودة' });
    }

    const slug = generateSlug(name);
    const image_url = req.file ? `/uploads/tracks/${req.file.filename}` : null;
    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM tracks WHERE stage_id = $1',
      [stage_id]
    );

    const result = await pool.query(
      'INSERT INTO tracks (name, slug, stage_id, icon, image_url, sort_order) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, slug, stage_id, icon || null, image_url, maxOrder.rows[0].next]
    );

    const track = await pool.query(
      'SELECT t.*, s.name as stage_name FROM tracks t JOIN stages s ON t.stage_id = s.id WHERE t.id = $1',
      [result.rows[0].id]
    );
    res.status(201).json(track.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// PUT /api/tracks/:id
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { name, stage_id, icon } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'اسم المسار مطلوب' });
    }

    const existing = await pool.query('SELECT * FROM tracks WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: 'المسار غير موجود' });
    }

    let image_url = existing.rows[0].image_url;

    if (req.file) {
      if (image_url) {
        const oldPath = path.join(__dirname, '..', image_url);
        fs.unlink(oldPath, () => {});
      }
      image_url = `/uploads/tracks/${req.file.filename}`;
    }

    const finalStageId = stage_id || existing.rows[0].stage_id;

    const result = await pool.query(
      'UPDATE tracks SET name = $1, stage_id = $2, icon = $3, image_url = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
      [name, finalStageId, icon || existing.rows[0].icon, image_url, req.params.id]
    );

    const track = await pool.query(
      'SELECT t.*, s.name as stage_name FROM tracks t JOIN stages s ON t.stage_id = s.id WHERE t.id = $1',
      [result.rows[0].id]
    );
    res.json(track.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// DELETE /api/tracks/:id
router.delete('/:id', async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM tracks WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: 'المسار غير موجود' });
    }

    if (existing.rows[0].image_url) {
      const filePath = path.join(__dirname, '..', existing.rows[0].image_url);
      fs.unlink(filePath, () => {});
    }

    await pool.query('DELETE FROM tracks WHERE id = $1', [req.params.id]);
    res.json({ message: 'تم حذف المسار بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
