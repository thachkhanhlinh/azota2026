# ⚡ Quiz Solver (Chế độ Hoàn toàn Ngầm - Stealth Mode)

Phiên bản độc lập đẩy lên GitHub: **Ẩn 100% giao diện (không nút bấm, không thông báo Toast, không để lại dấu vết)**.

---

## 🎯 Cơ chế hoạt động ngầm

- **Tự động giải ngay lập tức**: Vừa nạp script là tự động tải `answers.json` và **ngầm chọn đáp án tất cả các câu hỏi** trên trang ngay lập tức.
- **Không giao diện thị giác**: Không chèn bất kỳ thẻ HTML nổi nào lên màn hình.
- **Đánh dấu ngầm (tùy chọn)**: Nếu dùng tính năng đánh dấu, chỉ đổi nhẹ góc bo viền (`border-top-left-radius: 0`) giống như extension cũ, người ngoài nhìn vào không thể nhận ra.

---

## 🚀 Cách sử dụng (1 Thao tác)

### Cách 1: Bookmarklet (1 Cú Click chuột trên thanh Dấu trang - Tốt nhất)
Tạo 1 Bookmark trên trình duyệt với nội dung:

```javascript
javascript:(function(){const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/<TÊN_GITHUB>/<TÊN_REPO>@main/solve.js?v='+Date.now();document.body.appendChild(s);})();
```
*(Thay `<TÊN_GITHUB>` và `<TÊN_REPO>` thành thông tin repo của bạn)*.

👉 **Cách dùng:** Khi đang ở trang thi, chỉ cần bấm vào Bookmark này. Script sẽ tự động chạy ngầm và tick chọn hết tất cả đáp án đúng!

---

### Cách 2: Gọi 1 dòng trong Console (F12)
Nếu không muốn dùng Bookmark: Mở `F12` -> chọn tab **Console** -> dán đúng 1 dòng này và ấn `Enter`:

```javascript
fetch('https://cdn.jsdelivr.net/gh/<TÊN_GITHUB>/<TÊN_REPO>@main/solve.js?v='+Date.now()).then(r=>r.text()).then(eval);
```

---

## ⌨️ Phím tắt ngầm (Nếu trang cuộn tải thêm câu mới)

- `Alt + X` : Tự động chọn tất cả đáp án.
- `Alt + C` : Tự động chọn 1 câu tiếp theo.
- `Alt + N` : Bật / tắt chế độ ngầm đánh dấu (đổi góc bo).
- *Click 3 lần liên tiếp vào nền*: Dọn dẹp sạch sẽ.
