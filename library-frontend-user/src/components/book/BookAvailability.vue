<script setup>
import { computed } from 'vue';
import StatusBadge from '@/components/common/StatusBadge.vue';

const props = defineProps({
  availableCopies: { type: Number, default: 0 },
});

const isAvailable = computed(() => Number(props.availableCopies) > 0);
const label = computed(() => (isAvailable.value ? `Còn ${props.availableCopies} quyển` : 'Hết sách'));
</script>

<template>
  <span class="book-availability">
    <StatusBadge
      :type="'book'"
      :status="isAvailable ? 'available' : 'unavailable'"
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
