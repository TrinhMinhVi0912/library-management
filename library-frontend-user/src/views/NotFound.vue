<template>
  <main class="not-found-page">
    <section class="not-found-card text-center">
      <div
        class="not-found-icon"
        aria-hidden="true"
      >
        <i class="bi bi-compass" />
      </div>
      <p class="not-found-code mb-2">
        404 · Lạc giữa những trang sách
      </p>
      <h1 class="h2 fw-bold mb-2">
        Không tìm thấy trang
      </h1>
      <p class="not-found-description mb-4">
        Địa chỉ này không tồn tại hoặc đã được thay đổi. Hãy quay về thư viện để tiếp tục khám phá.
      </p>
      <RouterLink
        class="btn btn-primary px-4"
        :to="{ name: 'home' }"
      >
        <i
          class="bi bi-house-door me-2"
          aria-hidden="true"
        />Về trang chủ
      </RouterLink>
    </section>
  </main>
</template>

<style scoped>
.not-found-page {
  position: relative;
  isolation: isolate;
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 2rem 1rem;
  color: #d5e8f1;
}

.not-found-page::before {
  position: absolute;
  z-index: -1;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 100vw;
  background: radial-gradient(ellipse at 50% 0%, rgb(13 61 83 / 28%), transparent 44%), #041321;
  content: '';
  transform: translateX(-50%);
}

.not-found-card {
  width: min(100%, 38rem);
  border: 1px solid rgb(119 177 202 / 20%);
  border-radius: 1.25rem;
  background: linear-gradient(145deg, #0a2338, #081d31);
  padding: clamp(2rem, 6vw, 3.5rem);
  box-shadow: 0 1rem 3rem rgb(0 8 20 / 30%);
}

.not-found-icon {
  display: grid;
  width: 4.5rem;
  height: 4.5rem;
  place-items: center;
  margin: 0 auto 1.25rem;
  border: 1px solid rgb(91 223 234 / 22%);
  border-radius: 1.25rem;
  background: #103a50;
  color: #72e5ed;
  font-size: 2rem;
}

.not-found-code { color: #72e5ed; font-size: .8rem; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
.not-found-card h1 { color: #edf7fb; }
.not-found-description { color: #9eb4c3; line-height: 1.7; }
.not-found-page :deep(.btn-primary) { border-color: #0b91a4; background: #0b91a4; color: #fff; }
.not-found-page :deep(.btn-primary:hover) { border-color: #16adbf; background: #16adbf; }
</style>
