# AGENTS.md – library-frontend

Quy tắc chung: `../AGENTS.md`. Chi tiết nền: `../context/digest.md` §D5, D8, D9.

- Stack: Vue 3 (Vite, `<script setup>`), Bootstrap 5 + SCSS, vue-router, Pinia, axios, socket.io-client, bootstrap-icons, chart.js + vue-chartjs, vee-validate + yup, vue-toastification, dayjs, sweetalert2.
- Cấu trúc: `src/{assets,components/{common,book,loan,forum,admin},layouts,router,services,stores,views/{public,reader,forum,admin}}`. Alias `@` → `src`.
- View/component không gọi axios; đi qua `services/*` hoặc store. Access token trong Pinia (memory), refresh bằng cookie (`withCredentials`).
- Mỗi trang có đủ skeleton / EmptyState / lỗi (toast + thử lại). Màu/bo góc theo tokens (digest §D8); trạng thái dùng `StatusBadge`.
- Biến `VITE_API_URL`, `VITE_SOCKET_URL` được nhúng lúc build; không đặt secret vào `VITE_*`.
- Chạy: `npm run dev`, `npm run build`, `npm run lint`.
