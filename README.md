# LongWallet - Backend Service

Hệ thống Backend và cơ sở dữ liệu cho ứng dụng quản lý chi tiêu cá nhân thông minh **LongWallet**.

## 🚀 Công nghệ sử dụng
- **Database Engine**: PostgreSQL 17 (qua Supabase)
- **Bảo mật**: Row-Level Security (RLS) cho tất cả các bảng dữ liệu
- **Tự động hóa**: Database Triggers (PL/pgSQL) xử lý biến động số dư và khởi tạo người dùng
- **Storage**: Supabase Storage cho lưu trữ hóa đơn / chứng từ giao dịch

## 📂 Cấu trúc thư mục
```
backend/
├── .env.example              # Mẫu cấu hình biến môi trường
├── .gitignore                # Danh sách file loại trừ khỏi git
├── README.md                 # Tài liệu hướng dẫn
└── supabase/
    └── migrations/
        └── 20261022000000_init_schema.sql  # Schema CSDL khởi tạo
```

## 🗄️ Cấu trúc Cơ sở dữ liệu (Tables)
1. **`profiles`**: Thông tin người dùng, liên kết với `auth.users`, tiền tệ mặc định (`VND`).
2. **`wallets`**: Danh sách ví (Tiền mặt, Ngân hàng, Ví điện tử), số dư hiện tại, mã ngân hàng (`bank_code`), package app Android (`package_name`) phục vụ bắt biến động số dư.
3. **`categories`**: Danh mục thu/chi (Ăn uống, Di chuyển, Mua sắm, Hóa đơn, Lương,...).
4. **`category_keywords`**: Từ khóa nhận diện tự động cho từng danh mục (phục vụ regex auto-detect từ SMS/Push notification ngân hàng).
5. **`transactions`**: Lịch sử giao dịch thu, chi, chuyển khoản. Chống trùng lặp bằng index `raw_hash`.
6. **`budgets`**: Thiết lập hạn mức ngân sách chi tiêu hàng tháng theo danh mục.

## ⚡ Triggers & Tự động hóa
- **`handle_new_user()`**: Tự động tạo bản ghi `profile` và tạo ví `Ví tiền mặt` mặc định ngay khi người dùng đăng ký tài khoản qua Supabase Auth.
- **`handle_wallet_balance_change()`**: Tự động tính toán lại số dư `wallets.current_balance` khi giao dịch được xác nhận (`INSERT`, `UPDATE`, `DELETE`).

## 🛠️ Cài đặt & Triển khai
1. Sao chép cấu hình:
   ```bash
   cp .env.example .env
   ```
2. Điền thông tin `SUPABASE_URL` và `SUPABASE_ANON_KEY` của dự án Supabase.
3. Chạy migration:
   - Sử dụng Supabase CLI: `supabase db push` hoặc chạy trực tiếp nội dung file [`supabase/migrations/20261022000000_init_schema.sql`](supabase/migrations/20261022000000_init_schema.sql) trong SQL Editor trên Supabase Dashboard.
