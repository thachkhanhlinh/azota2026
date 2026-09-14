# ⚡ Quiz Solver (Chế độ Hoàn toàn Ngầm - Stealth Mode)

Phiên bản độc lập đẩy lên GitHub: **Ẩn 100% giao diện (không nút bấm, không thông báo Toast, không để lại dấu vết)**.

---

## 🎯 Cơ chế hoạt động ngầm

- **Tự động bo góc ngầm**: Vừa nạp script là tự động tải `answers.json` và **bo góc kín đáo** các đáp án đúng trên trang. Muốn tự động click chọn tất cả thì bấm `Alt + X`.
- **Không giao diện thị giác**: Không chèn bất kỳ thẻ HTML nổi nào lên màn hình.
- **Đánh dấu ngầm**: Đổi góc bo viền (`border-top-left-radius: 0`) như extension cũ, người ngoài nhìn vào không thể nhận ra.

---

## 🚀 Cách cài đặt Bookmarklet (Kéo thả siêu nhanh)

1. Mở file [install.html](file:///e:/Download/Tien_ich_vui_ve/quiz-solver/install.html) bằng trình duyệt (nhấp đúp chuột vào file).
2. Bấm `Ctrl + Shift + B` để hiện thanh dấu trang.
3. Kéo nút **🎯 Azota Solver** thả lên thanh dấu trang.

---

## 🚀 Cách sử dụng

### Cách 1: Bấm Bookmarklet trên thanh Dấu trang
👉 Khi đang ở trang thi, chỉ cần bấm Bookmarklet vừa kéo lên. Script sẽ tự động nạp và bo góc các câu hỏi! Bấm `Alt + X` để tự tick chọn đáp án.

---

### Cách 2: Gọi 1 dòng trong Console (F12)
Nếu không muốn dùng Bookmark: Mở `F12` -> chọn tab **Console** -> dán đúng 1 dòng này và ấn `Enter`:

```javascript
fetch('https://cdn.jsdelivr.net/gh/thachkhanhlinh/azota2026@main/solve.js?v='+Date.now()).then(r=>r.text()).then(eval);
```

---

## ⌨️ Phím tắt ngầm (Nếu trang cuộn tải thêm câu mới)

- `Alt + X` : Tự động chọn tất cả đáp án.
- `Alt + C` : Tự động chọn 1 câu tiếp theo.
- `Alt + N` : Bật / tắt chế độ ngầm đánh dấu (đổi góc bo).
- *Click 3 lần liên tiếp vào nền*: Dọn dẹp sạch sẽ.
