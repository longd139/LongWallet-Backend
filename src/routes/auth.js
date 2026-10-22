const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { requireAuth } = require('../middlewares/auth');

// POST /api/auth/register - Đăng ký tài khoản mới
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email và mật khẩu là bắt buộc',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Mật khẩu phải có ít nhất 6 ký tự',
      });
    }

    let user, session;

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Dùng Admin API (bỏ qua hoàn toàn rate limit email)
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name || email.split('@')[0],
        },
      });

      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }
      user = data.user;
    } else {
      // Fallback signUp client
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: full_name || email.split('@')[0],
          },
        },
      });

      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }
      user = data.user;
      session = data.session;
    }

    res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công',
      data: {
        user: {
          id: user?.id,
          email: user?.email,
          fullName: user?.user_metadata?.full_name,
        },
        session: session ? {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresIn: session.expires_in,
        } : null,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/login - Đăng nhập bằng Email và Password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp email và mật khẩu',
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({
        success: false,
        error: 'Email hoặc mật khẩu không chính xác',
      });
    }

    // Lấy thông tin profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
          fullName: profile?.full_name || data.user.user_metadata?.full_name,
          avatarUrl: profile?.avatar_url,
          defaultCurrency: profile?.default_currency || 'VND',
        },
        tokens: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresIn: data.session.expires_in,
          tokenType: 'Bearer',
        },
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/refresh - Làm mới access token từ refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'refreshToken là bắt buộc',
      });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token không hợp lệ hoặc đã hết hạn',
      });
    }

    res.json({
      success: true,
      message: 'Làm mới token thành công',
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
      },
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/me - Lấy thông tin tài khoản hiện tại (Yêu cầu đăng nhập)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;

    // Lấy số lượng ví
    const { count: walletCount } = await supabase
      .from('wallets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    res.json({
      success: true,
      data: {
        id: req.user.id,
        email: req.user.email,
        fullName: profile?.full_name,
        avatarUrl: profile?.avatar_url,
        defaultCurrency: profile?.default_currency,
        walletCount: walletCount || 0,
        createdAt: profile?.created_at,
      },
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/logout - Đăng xuất
router.post('/logout', requireAuth, async (req, res) => {
  try {
    // Supabase auth client logout
    await supabase.auth.signOut();
    res.json({
      success: true,
      message: 'Đăng xuất thành công',
    });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
