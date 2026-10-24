const express = require('express');
const router = express.Router();
require('dotenv').config();

/**
 * POST /api/ai/financial-plan
 * Nhận thông tin: tổng số dư, danh sách nợ, mục tiêu lớn, danh mục chi tiêu
 * Gọi Google Gemini 1.5 Flash để phân tích và tự động tạo ngân sách chi tiêu
 */
router.post('/financial-plan', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      return res.status(500).json({
        success: false,
        error: 'Chưa cấu hình GEMINI_API_KEY trong file .env của backend.',
      });
    }

    const {
      totalBalance = 0,
      debts = [],
      goal = null,
      categories = [],
      monthlyIncomeEstimate = 0,
    } = req.body;

    // Tổng hợp số liệu
    const totalRemainingDebt = debts.reduce((sum, d) => sum + (Number(d.remainingAmount) || 0), 0);
    const totalMonthlyDebtDue = debts.reduce((sum, d) => sum + (Number(d.monthlyDue) || 0), 0);

    const prompt = `
Bạn là một chuyên gia cố vấn tài chính cá nhân thông minh, thực tế và tâm lý cho ứng dụng LongWallet.
Nhiệm vụ của bạn là phân tích bức tranh tài chính hiện tại của người dùng và TỰ ĐỘNG THIẾT LẬP KẾ HOẠCH NGÂN SÁCH (BUDGET) CHI TIÊU HỢP LÝ cho tháng này.

DỮ LIỆU TÀI CHÍNH CỦA NGƯỜI DÙNG:
- Tổng số dư khả dụng hiện có trong ví: ${totalBalance.toLocaleString('vi-VN')} đ
- Tình trạng nợ:
  + Danh sách nợ: ${JSON.stringify(debts)}
  + Tổng dư nợ còn lại: ${totalRemainingDebt.toLocaleString('vi-VN')} đ
  + Tiền nợ cần trả tháng này: ${totalMonthlyDebtDue.toLocaleString('vi-VN')} đ
- Mục tiêu tài chính lớn đang theo đuổi:
  + Tên mục tiêu: ${goal ? goal.name : 'Chưa thiết lập'}
  + Số tiền cần tích lũy: ${goal ? Number(goal.targetAmount).toLocaleString('vi-VN') + ' đ' : '0 đ'}
  + Đã tích lũy được: ${goal ? Number(goal.currentBalance).toLocaleString('vi-VN') + ' đ' : '0 đ'}
- Danh sách các danh mục chi tiêu trong hệ thống:
  ${JSON.stringify(categories)}
${monthlyIncomeEstimate > 0 ? `- Thu nhập ước tính hàng tháng: ${monthlyIncomeEstimate.toLocaleString('vi-VN')} đ` : ''}

YÊU CẦU PHÂN TÍCH VÀ ĐỀ XUẤT:
1. Đánh giá tổng quan dòng tiền: Số dư hiện tại so với áp lực trả nợ tháng này và mục tiêu lớn.
2. Chiến lược trả nợ: Ưu tiên trả đúng hạn phần nợ kỳ này để tránh phát sinh lãi phạt.
3. Kế hoạch tích lũy mục tiêu: Đề xuất số tiền trích tiết kiệm tháng này (suggested_goal_savings) sao cho vừa sức nhưng vẫn duy trì ngọn lửa mục tiêu.
4. TỰ ĐỘNG TẠO HẠN MỨC NGÂN SÁCH (suggested_budgets) cho TẤT CẢ các danh mục chi tiêu có trong danh sách trên:
   - Phân bổ hạn mức chi tiêu (amount_limit) hợp lý, thực tế với mức sống hiện nay (ví dụ: Ăn uống, Đi lại, Hóa đơn là thiết yếu; Mua sắm, Giải trí cần thắt chặt nếu đang có nợ).
   - Mỗi phần tử trong suggested_budgets phải gồm:
     * category_id: string (chính xác id trong danh mục)
     * category_name: string (tên danh mục)
     * amount_limit: number (số tiền hạn mức VNĐ làm tròn chẵn theo chục nghìn hoặc trăm nghìn)
     * reason: string (1 câu giải thích lý do ngắn gọn bằng tiếng Việt)
5. 2-3 mẹo hành động cụ thể (tips) giúp người dùng tiết kiệm ngay hôm nay.

BẮT BUỘC TRẢ VỀ ĐỊNH DẠNG JSON THEO SCHEMA SAU:
{
  "summary": "Tóm tắt ngắn gọn 1-2 câu về tình hình tài chính...",
  "strategy": {
    "overview": "Đánh giá chi tiết dòng tiền...",
    "debt_plan": "Chiến lược cụ thể cho các khoản nợ...",
    "goal_plan": "Chiến lược tích lũy để đạt được mục tiêu..."
  },
  "suggested_goal_savings": 50000,
  "suggested_budgets": [
    {
      "category_id": "id_cua_category",
      "category_name": "Ten category",
      "amount_limit": 1500000,
      "reason": "Lý do đặt mức này..."
    }
  ],
  "tips": [
    "Mẹo 1",
    "Mẹo 2"
  ]
}
`.trim();

    // Gọi Gemini 3.5 Flash REST API (tốc độ cao, hỗ trợ JSON Schema)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('Gemini API Error:', geminiResponse.status, errText);
      return res.status(geminiResponse.status).json({
        success: false,
        error: `Gemini API trả về lỗi: ${geminiResponse.statusText}`,
        details: errText,
      });
    }

    const data = await geminiResponse.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return res.status(500).json({
        success: false,
        error: 'Không nhận được phản hồi hợp lệ từ Gemini AI.',
      });
    }

    // Parse JSON từ Gemini
    let planData;
    try {
      planData = JSON.parse(candidateText);
    } catch (e) {
      console.error('Failed to parse Gemini JSON output:', candidateText);
      return res.status(500).json({
        success: false,
        error: 'Định dạng phản hồi từ AI không phải JSON chuẩn.',
        raw: candidateText,
      });
    }

    return res.json({
      success: true,
      data: planData,
    });
  } catch (error) {
    console.error('Error in /api/ai/financial-plan:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Lỗi xử lý kế hoạch tài chính với AI.',
    });
  }
});

module.exports = router;
