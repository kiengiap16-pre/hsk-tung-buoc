# HSK Từng Bước

Web học tiếng Trung theo chuẩn HSK 3.0 cấp 1–6.

- `index.html`: trang giới thiệu
- `app/`: web học (tải dữ liệu từ `app/data/`)

Đây là trang tĩnh, đưa lên GitHub Pages, Netlify hoặc Cloudflare Pages là chạy, không cần cài gì thêm.

Nguồn dữ liệu: complete-hsk-vocabulary; CVDICT của Phong Phan (CC BY-SA 4.0, dịch từ CC-CEDICT); hanviet-pinyin-words (MIT); Make Me a Hanzi / Hanzi Writer.

## Tài khoản (tuỳ chọn)
Đăng nhập Google/Apple dùng Firebase. Cấu hình ở `app/firebase-config.js`; khi để `null`, web chạy như cũ và không hiện nút đăng nhập. Tiến độ người đã đăng nhập lưu ở Firestore, mục `users/{uid}`.

## Âm thanh
- `app/audio/w/`: ghi âm người thật cho từ HSK (Yue Tan, dự án audio-cmn của Hugo Lopez, giấy phép CC BY-SA), cộng các từ còn thiếu được ghép từ ghi âm âm tiết có áp dụng biến điệu (3-3, 不, 一).
- `app/audio/py/`: 1.679 âm tiết pinyin (Chen Wang, audio-cmn, CC BY-SA). Chữ đơn đọc bằng âm tiết đúng pinyin để không sai chữ đa âm.
- `app/data/audio.json`: bảng tra từ → file. Không có file thì trình duyệt tự đọc.
