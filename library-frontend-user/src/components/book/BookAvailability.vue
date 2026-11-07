<script setup>
import { computed } from 'vue';
import StatusBadge from '@/components/common/StatusBadge.vue';

const props = defineProps({
  availableCopies: { type: Number, default: 0 },
  heldForReader: { type: Boolean, default: false },
});

const isAvailable = computed(() => Number(props.availableCopies) > 0);
const label = computed(() => {
  if (props.heldForReader) return 'Đang giữ cho bạn';
  return isAvailable.value ? `Còn ${props.availableCopies} quyển` : 'Hết sách';
});
</script>

<template>
  <span class="book-availability">
    <StatusBadge
      :type="'book'"
      :status="isAvailable || heldForReader ? 'available' : 'unavailable'"
      :label="label"
    />
  </span>
</template>

<style scoped>
.book-availability {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

</style>
