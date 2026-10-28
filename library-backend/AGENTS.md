# AGENTS.md – library-backend

Quy tắc chung: `../AGENTS.md`. Chi tiết nền: `../context/digest.md` §D4–D7, D9.

- Stack: Express, Mongoose, JWT (access 15m + refresh httpOnly 7 ngày, rotate), bcryptjs, joi, Socket.IO, Cloudinary (multer memoryStorage), node-cron, nodemailer, helmet, cors, express-rate-limit, express-mongo-sanitize, morgan, swagger-ui-express, exceljs. Test: Jest + Supertest.
- Cấu trúc: `app/{config,controllers,models,routes,services,middlewares,validators,sockets,jobs,utils}`, `app/api-error.js`, `scripts/`, `app.js`, `server.js`.
- Tên file: `x.controller.js`, `x.route.js`, `x.service.js`, `x.model.js`, `x.validator.js`, `x.util.js`, `x.job.js`.
- Prefix `/api/v1`; `ok(res,data,meta)`; lỗi `throw new ApiError(status,msg,errors)`; bọc async bằng `asyncHandler`.
- `app.set('trust proxy',1)`; CORS theo `CLIENT_URL`; `GET /health`; `POST /jobs/:name` có `x-jobs-secret`.
- Mongoose được giả định (D-009). Mỗi service nghiệp vụ có JSDoc ngắn nêu điều kiện + tham chiếu mục tài liệu.
- Chạy: `npm run dev`, `npm run lint`, `npm test`, `npm run seed`, `npm run create-admin`.
