const express = require('express');
const router = express.Router();
require('dotenv').config();

const GEMINI_MODEL = 'gemini-3.5-flash';

async function callGemini(apiKey, prompt) {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

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
    throw new Error(`Gemini API trả về lỗi (${geminiResponse.status}): ${geminiResponse.statusText}`);
  }

  const data = await geminiResponse.json();
  const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidateText) {
    throw new Error('Không nhận được phản hồi hợp lệ từ Gemini AI.');
  }

  return JSON.parse(candidateText);
}

/**
 * BƯỚC 1: Phân tích tình hình tài chính hiện tại và sinh ra các câu hỏi chi tiêu cố định
 * POST /api/ai/initial-analysis
 */
router.post('/initial-analysis', async (req, res) => {
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
    } = req.body;

    const totalRemainingDebt = debts.reduce((sum, d) => sum + (Number(d.remainingAmount) || 0), 0);
    const totalMonthlyDebtDue = debts.reduce((sum, d) => sum + (Number(d.monthlyDue) || 0), 0);

    const prompt = `
Bạn là một chuyên gia cố vấn tài chính cá nhân thông minh và thực tế cho ứng dụng LongWallet.
Người dùng vừa mở tính năng Lập Kế Hoạch Tài Chính. Trước khi tạo ngân sách chi tiêu, bạn cần:
1. Đưa ra một phân tích ngắn gọn, sắc bén và thực tế về bức tranh tài chính hiện tại (Số dư ví, áp lực nợ tháng này, mục tiêu lớn).
2. Đặt ra đúng 3 câu hỏi phỏng vấn tương tác ngắn gọn để hiểu rõ về dòng tiền thực tế và chi tiêu cố định hàng tháng của người dùng.

DỮ LIỆU HIỆN CÓ CỦA NGƯỜI DÙNG:
- Số dư khả dụng hiện có trong ví: ${totalBalance.toLocaleString('vi-VN')} đ
- Khoản nợ & nghĩa vụ nợ:
  + Danh sách nợ: ${JSON.stringify(debts)}
  + Tổng nợ còn lại: ${totalRemainingDebt.toLocaleString('vi-VN')} đ
  + Tiền nợ cần trả tháng này: ${totalMonthlyDebtDue.toLocaleString('vi-VN')} đ
- Mục tiêu tài chính lớn:
  + Tên: ${goal ? goal.name : 'Chưa có'}
  + Cần tích lũy: ${goal ? Number(goal.targetAmount).toLocaleString('vi-VN') + ' đ' : '0 đ'}
  + Đã tích lũy được: ${goal ? Number(goal.currentBalance).toLocaleString('vi-VN') + ' đ' : '0 đ'}

YÊU CẦU ĐẦU RA JSON:
{
  "summary": "1-2 câu nhận xét tổng quan về tình hình tài chính hiện tại...",
  "overview": "Đánh giá chi tiết về áp lực nợ tháng này và khả năng đạt mục tiêu nếu chỉ dựa vào số dư hiện tại...",
  "questions": [
    {
      "id": "monthly_income",
      "question": "Thu nhập hoặc tiền chu cấp dự kiến tháng này của bạn khoảng bao nhiêu?",
      "subtitle": "Bao gồm lương, thưởng hoặc các nguồn thu khác",
      "default_value": 8000000,
      "quick_options": [3000000, 5000000, 8000000, 12000000, 15000000]
    },
    {
      "id": "fixed_expenses",
      "question": "Các khoản chi phí cố định bắt buộc tháng này là bao nhiêu?",
      "subtitle": "Tiền thuê nhà, phòng trọ, điện nước, internet, gửi xe...",
      "default_value": 2000000,
      "quick_options": [1000000, 2000000, 3000000, 4500000]
    },
    {
      "id": "food_allowance",
      "question": "Mức chi phí ăn uống dự kiến bạn muốn duy trì mỗi tháng?",
      "subtitle": "Ví dụ: 50.000đ/ngày (~1.5 triệu/tháng) hoặc 80.000đ/ngày (~2.4 triệu/tháng)",
      "default_value": 2000000,
      "quick_options": [1500000, 2000000, 2500000, 3000000]
    }
  ]
}
`.trim();

    const result = await callGemini(apiKey, prompt);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in /api/ai/initial-analysis:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi phân tích tài chính ban đầu.',
    });
  }
});

/**
 * BƯỚC 2: Dựa trên câu trả lời của người dùng để lập ngân sách toàn diện và kế hoạch mục tiêu
 * POST /api/ai/finalize-budget
 */
router.post('/finalize-budget', async (req, res) => {
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
      answers = {},
    } = req.body;

    const totalRemainingDebt = debts.reduce((sum, d) => sum + (Number(d.remainingAmount) || 0), 0);
    const totalMonthlyDebtDue = debts.reduce((sum, d) => sum + (Number(d.monthlyDue) || 0), 0);

    const monthlyIncome = Number(answers.monthly_income) || 0;
    const fixedExpenses = Number(answers.fixed_expenses) || 0;
    const foodAllowance = Number(answers.food_allowance) || 0;

    const prompt = `
Bạn là một chuyên gia cố vấn tài chính cá nhân cho ứng dụng LongWallet.
Người dùng đã cung cấp đầy đủ thông tin chi tiêu cố định và thu nhập hàng tháng. Nhiệm vụ của bạn là LẬP KẾ HOẠCH TÀI CHÍNH VÀ BẢNG NGÂN SÁCH (BUDGET) CHI TIÊU TOÀN DIỆN, THỰC TẾ VÀ KHẢ THI NHẤT.

BỨC TRANH TÀI CHÍNH ĐẦY ĐỦ:
1. Thu nhập hàng tháng: ${monthlyIncome.toLocaleString('vi-VN')} đ
2. Số dư khả dụng hiện có trong ví: ${totalBalance.toLocaleString('vi-VN')} đ
3. Nghĩa vụ nợ:
   - Danh sách nợ: ${JSON.stringify(debts)}
   - Tổng nợ còn lại: ${totalRemainingDebt.toLocaleString('vi-VN')} đ
   - Cần trả đúng hạn tháng này: ${totalMonthlyDebtDue.toLocaleString('vi-VN')} đ
4. Chi phí cố định người dùng khai báo:
   - Tiền nhà, điện nước, internet: ${fixedExpenses.toLocaleString('vi-VN')} đ
   - Mức ăn uống mong muốn: ${foodAllowance.toLocaleString('vi-VN')} đ
5. Mục tiêu lớn:
   - Tên: ${goal ? goal.name : 'Chưa có'}
   - Cần tích lũy: ${goal ? Number(goal.targetAmount).toLocaleString('vi-VN') + ' đ' : '0 đ'}
   - Đã có trong ví mục tiêu: ${goal ? Number(goal.currentBalance).toLocaleString('vi-VN') + ' đ' : '0 đ'}
6. Các danh mục chi tiêu trong hệ thống:
   ${JSON.stringify(categories)}

YÊU CẦU:
1. Đưa ra chiến lược tài chính tổng quan theo nguyên tắc 50/30/20 hoặc điều chỉnh theo áp lực nợ + mua xe:
   - Ưu tiên 1: Chi phí cố định & ăn uống thiết yếu.
   - Ưu tiên 2: Trả nợ đúng hạn tháng này (${totalMonthlyDebtDue.toLocaleString('vi-VN')} đ) để không bị nợ xấu/phạt lãi.
   - Ưu tiên 3: Tích lũy mục tiêu mua xe Winner X V4 (suggested_goal_savings) và ước tính số tháng dự kiến để đạt mục tiêu nếu duy trì mức này.
   - Ưu tiên 4: Kiểm soát chi tiêu không thiết yếu (Mua sắm, Giải trí...).
2. TỰ ĐỘNG PHÂN BỔ HẠN MỨC NGÂN SÁCH (suggested_budgets) cho TẤT CẢ các danh mục chi tiêu trong danh sách trên:
   - Cân đối số tiền hạn mức (amount_limit) dựa trên số liệu người dùng đã cung cấp (ví dụ tiền ăn uống bám sát ${foodAllowance.toLocaleString('vi-VN')} đ, tiền hóa đơn bám sát ${fixedExpenses.toLocaleString('vi-VN')} đ).
   - Mỗi phần tử phải có:
     * category_id: string
     * category_name: string
     * amount_limit: number
     * reason: string (lý do cụ thể)
3. 2-3 mẹo hành động thiết thực.

TRẢ VỀ ĐỊNH DẠNG JSON:
{
  "summary": "Tóm tắt 1-2 câu kết quả phân tích...",
  "strategy": {
    "overview": "Đánh giá dòng tiền tổng thể...",
    "debt_plan": "Kế hoạch trả nợ...",
    "goal_plan": "Kế hoạch tích lũy mục tiêu và thời gian dự kiến hoàn thành...",
    "estimated_months_to_goal": 12
  },
  "suggested_goal_savings": 500000,
  "suggested_budgets": [
    {
      "category_id": "...",
      "category_name": "...",
      "amount_limit": 2000000,
      "reason": "..."
    }
  ],
  "tips": [
    "Mẹo 1",
    "Mẹo 2"
  ]
}
`.trim();

    const result = await callGemini(apiKey, prompt);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in /api/ai/finalize-budget:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi tạo ngân sách chi tiêu.',
    });
  }
});

/**
 * Route cũ (giữ tương thích)
 */
router.post('/financial-plan', async (req, res) => {
  req.url = '/finalize-budget';
  return router.handle(req, res);
});

module.exports = router;
