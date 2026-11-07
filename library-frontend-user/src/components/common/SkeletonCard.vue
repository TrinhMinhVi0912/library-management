<script setup>
const props = defineProps({
  showImage: { type: Boolean, default: true },
  lines: { type: Number, default: 3, validator: (value) => value >= 1 && value <= 6 },
});
</script>

<template>
  <article
    class="card h-100"
    aria-busy="true"
    aria-label="Đang tải nội dung"
  >
    <div
      v-if="props.showImage"
      class="placeholder-glow"
    >
      <span class="placeholder col-12 skeleton-image" />
    </div>
    <div class="card-body placeholder-glow">
      <span class="placeholder col-8 mb-3" />
      <span
        v-for="line in props.lines"
        :key="line"
        class="placeholder col-10 mb-2"
      />
    </div>
  </article>
</template>

<style scoped>
.skeleton-image {
  height: 10rem;
}
</style>
