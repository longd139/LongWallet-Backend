const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { requireAuth } = require('../middlewares/auth');

router.use(requireAuth);

// GET /api/analytics/summary - Get total income, expense, and net balance
router.get('/summary', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let query = supabase
      .from('transactions')
      .select('amount, type, status')
      .eq('user_id', req.user.id)
      .eq('status', 'CONFIRMED');

    if (start_date) query = query.gte('transaction_date', start_date);
    if (end_date) query = query.lte('transaction_date', end_date);

    const { data, error } = await query;
    if (error) throw error;

    let totalIncome = 0;
    let totalExpense = 0;

    data.forEach((tx) => {
      if (tx.type === 'INCOME') totalIncome += Number(tx.amount);
      if (tx.type === 'EXPENSE') totalExpense += Number(tx.amount);
    });

    res.json({
      success: true,
      data: {
        totalIncome,
        totalExpense,
        netSavings: totalIncome - totalExpense,
        transactionCount: data.length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
