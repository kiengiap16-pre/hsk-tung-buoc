// Cấu hình Firebase của web (đây là thông tin công khai, không phải mật khẩu).
// Khi còn để null thì web chạy như cũ, không hiện nút đăng nhập.
// Dán đoạn firebaseConfig lấy trong Firebase Console vào đây, ví dụ:
// window.FIREBASE_CONFIG = { apiKey: "...", authDomain: "....firebaseapp.com", projectId: "...", appId: "..." };
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyC-R5wSIK2KWW4Za7QSpGZH10I35KHVS3M",
  authDomain: "hsk-tung-buoc.firebaseapp.com",
  projectId: "hsk-tung-buoc",
  storageBucket: "hsk-tung-buoc.firebasestorage.app",
  messagingSenderId: "255155954843",
  appId: "1:255155954843:web:c05881b66989e20a6e923e"
};
// Đổi thành true khi đã bật đăng nhập Apple trong Firebase (cần tài khoản Apple Developer).
window.FIREBASE_APPLE = false;
