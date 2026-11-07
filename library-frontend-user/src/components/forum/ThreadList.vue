<script setup>
import ThreadItem from '@/components/forum/ThreadItem.vue';
import EmptyState from '@/components/common/EmptyState.vue';

defineProps({
  threads: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  emptyTitle: {
    type: String,
    default: 'Chưa có chủ đề nào',
  },
  emptyDescription: {
    type: String,
    default: 'Hãy là người đầu tiên mở đầu cuộc thảo luận này!',
  },
  showCategory: {
    type: Boolean,
    default: true,
  },
  compact: {
    type: Boolean,
    default: false,
  },
  emptyActionLabel: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['empty-action']);
</script>

<template>
  <div class="thread-list">
    <!-- Loading skeleton state -->
    <div
      v-if="loading"
      class="thread-skeletons"
    >
      <div
        v-for="n in (compact ? 3 : 5)"
        :key="n"
        class="card border rounded-3 p-3 mb-3 bg-white shadow-sm placeholder-glow"
      >
        <div class="d-flex align-items-center gap-3">
          <div class="rounded-circle placeholder bg-secondary-subtle flex-shrink-0 skeleton-avatar" />
          <div class="w-100">
            <div class="d-flex gap-2 mb-2">
              <span class="placeholder col-2 bg-secondary-subtle rounded" />
              <span class="placeholder col-1 bg-secondary-subtle rounded" />
            </div>
            <div class="placeholder col-8 bg-secondary-subtle rounded mb-2" />
            <div class="placeholder col-4 bg-secondary-subtle rounded" />
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="threads.length === 0"
      class="card border rounded-3 p-4 bg-white shadow-sm text-center"
    >
      <EmptyState
        :title="emptyTitle"
        :description="emptyDescription"
        icon="bi-chat-square-text"
        :action-label="emptyActionLabel"
        @action="emit('empty-action')"
      />
    </div>

    <!-- Threads list -->
    <div
      v-else
      class="threads-container"
    >
      <ThreadItem
        v-for="thread in threads"
        :key="thread._id"
        :thread="thread"
        :show-category="showCategory"
        :compact="compact"
      />
    </div>
  </div>
</template>

<style scoped>
.skeleton-avatar {
  width: 2.75rem;
  height: 2.75rem;
}
</style>

