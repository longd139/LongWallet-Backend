const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { requireAuth } = require('../middlewares/auth');

router.use(requireAuth);

// GET /api/transactions - List transactions
router.get('/', async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;

    let query = supabase
      .from('transactions')
      .select('*, wallets(name, bank_code), categories(name, icon, color)')
      .eq('user_id', req.user.id)
      .order('transaction_date', { ascending: false })
      .limit(Number(limit));

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/transactions - Create transaction
router.post('/', async (req, res) => {
  try {
    const {
      wallet_id,
      category_id,
      amount,
      type,
      transaction_date,
      note,
      receipt_url,
      is_auto_detected,
      raw_message,
      raw_hash,
      status = 'CONFIRMED',
    } = req.body;

    if (!wallet_id || !amount || !type) {
      return res.status(400).json({
        success: false,
        error: 'wallet_id, amount, and type (INCOME/EXPENSE/TRANSFER) are required',
      });
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: req.user.id,
        wallet_id,
        category_id,
        amount,
        type,
        transaction_date: transaction_date || new Date().toISOString(),
        note,
        receipt_url,
        is_auto_detected: is_auto_detected || false,
        raw_message,
        raw_hash,
        status,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ success: false, error: 'Duplicate transaction (raw_hash exists)' });
      }
      throw error;
    }

    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/transactions/:id/status - Update status (e.g. approve/reject auto-detected tx)
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['CONFIRMED', 'PENDING', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const { data, error } = await supabase
      .from('transactions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
