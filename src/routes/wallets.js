const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { requireAuth } = require('../middlewares/auth');

// Apply auth to all wallet endpoints
router.use(requireAuth);

// GET /api/wallets - List user wallets
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('is_archived', false)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/wallets - Create new wallet
router.post('/', async (req, res) => {
  try {
    const { name, bank_code, account_number, package_name, current_balance, icon, color } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Wallet name is required' });
    }

    const { data, error } = await supabase
      .from('wallets')
      .insert({
        user_id: req.user.id,
        name,
        bank_code: bank_code || 'CASH',
        account_number,
        package_name,
        current_balance: current_balance || 0,
        icon: icon || 'wallet',
        color: color || '#10B981',
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
