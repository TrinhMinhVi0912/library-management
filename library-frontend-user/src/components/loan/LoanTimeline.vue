<script setup>
import { computed } from 'vue';
import { formatDate } from '@/utils/format';

const props = defineProps({
  loan: { type: Object, required: true },
});

const steps = computed(() => {
  const status = props.loan?.status || 'pending';
  const createdAt = props.loan?.createdAt;
  const approvedAt = props.loan?.approvedAt;
  const handedOverAt = props.loan?.handedOverAt;
  const closedAt = props.loan?.closedAt;
  const pickupDeadline = props.loan?.pickupDeadline;
  const rejectReason = props.loan?.rejectReason;

  // Tìm ngày hạn trả chung của sách
  const dueDates = (props.loan?.items || []).map((i) => i.dueDate).filter(Boolean);
  const earliestDue = dueDates.length ? dueDates.sort()[0] : null;

  // Step 1: Gửi yêu cầu
  const step1 = {
    title: 'Gửi yêu cầu',
    date: createdAt ? formatDate(createdAt, 'DD/MM/YYYY HH:mm') : '',
    status: status === 'cancelled' && !approvedAt ? 'error' : 'completed',
    desc: status === 'cancelled' && !approvedAt ? 'Độc giả đã hủy' : 'Đã gửi thành công',
  };

  // Step 2: Duyệt yêu cầu
  let step2Status = 'upcoming';
  let step2Desc = 'Chờ thủ thư duyệt';
  let step2Date = '';

  if (status === 'rejected') {
    step2Status = 'error';
    step2Desc = rejectReason ? `Bị từ chối: ${rejectReason}` : 'Bị từ chối';
  } else if (['approved', 'borrowing', 'overdue', 'returned', 'expired'].includes(status) || approvedAt) {
    step2Status = 'completed';
    step2Desc = 'Đã duyệt yêu cầu';
    step2Date = approvedAt ? formatDate(approvedAt, 'DD/MM/YYYY HH:mm') : '';
  } else if (status === 'cancelled') {
    step2Status = approvedAt ? 'completed' : 'disabled';
    step2Desc = approvedAt ? 'Đã duyệt trước khi hủy' : 'Đã hủy đơn';
  } else if (status === 'pending') {
    step2Status = 'current';
    step2Desc = 'Đang chờ thủ thư duyệt';
  }

  const step2 = {
    title: 'Duyệt yêu cầu',
    date: step2Date,
    status: step2Status,
    desc: step2Desc,
  };

  // Step 3: Nhận sách
  let step3Status = 'upcoming';
  let step3Desc = 'Nhận sách tại quầy';
  let step3Date = '';

  if (status === 'expired') {
    step3Status = 'error';
    step3Desc = 'Hết hạn giữ sách';
  } else if (['borrowing', 'overdue', 'returned'].includes(status) || handedOverAt) {
    step3Status = 'completed';
    step3Desc = 'Đã nhận sách';
    step3Date = handedOverAt ? formatDate(handedOverAt, 'DD/MM/YYYY HH:mm') : '';
  } else if (status === 'approved') {
    step3Status = 'current';
    step3Desc = pickupDeadline ? `Trước ${formatDate(pickupDeadline, 'DD/MM HH:mm')}` : 'Sẵn sàng tại quầy';
  } else if (['rejected', 'cancelled'].includes(status)) {
    step3Status = 'disabled';
    step3Desc = 'Không thực hiện';
  }

  const step3 = {
    title: 'Nhận sách',
    date: step3Date,
    status: step3Status,
    desc: step3Desc,
  };

  // Step 4: Trả sách
  let step4Status = 'upcoming';
  let step4Desc = 'Hoàn tất mượn trả';
  let step4Date = '';

  if (status === 'returned') {
    step4Status = 'completed';
    step4Desc = 'Đã trả đủ sách';
    step4Date = closedAt ? formatDate(closedAt, 'DD/MM/YYYY') : '';
  } else if (status === 'overdue') {
    step4Status = 'error';
    step4Desc = earliestDue ? `Quá hạn (hạn: ${formatDate(earliestDue, 'DD/MM')})` : 'Quá hạn trả';
  } else if (status === 'borrowing') {
    step4Status = 'current';
    step4Desc = earliestDue ? `Hạn: ${formatDate(earliestDue, 'DD/MM/YYYY')}` : 'Đang mượn';
  } else if (['rejected', 'cancelled', 'expired'].includes(status)) {
    step4Status = 'disabled';
    step4Desc = 'Không thực hiện';
  }

  const step4 = {
    title: 'Trả sách',
    date: step4Date,
    status: step4Status,
    desc: step4Desc,
  };

  return [step1, step2, step3, step4];
});

const completedTransitions = computed(() => {
  const firstIncompleteStep = steps.value.findIndex((step) => step.status !== 'completed');
  return firstIncompleteStep === -1 ? steps.value.length - 1 : Math.max(0, firstIncompleteStep);
});
</script>

<template>
  <div
    class="loan-timeline-wrap"
    aria-label="Tiến trình mượn trả sách"
  >
    <ol class="loan-timeline-list list-unstyled mb-0 d-flex flex-column flex-md-row">
      <li
        class="timeline-track d-none d-md-block"
        aria-hidden="true"
      >
        <span
          class="timeline-track-progress"
          :style="{ width: `${(completedTransitions / (steps.length - 1)) * 100}%` }"
        />
      </li>
      <li
        v-for="(step, idx) in steps"
        :key="idx"
        class="loan-timeline-step d-flex flex-row flex-md-column align-items-start align-items-md-center position-relative flex-md-1"
        :class="`step-${step.status}`"
      >
        <!-- Icon mốc tròn -->
        <div class="timeline-node rounded-circle d-flex align-items-center justify-content-center shadow-xs flex-shrink-0">
          <i
            v-if="step.status === 'completed'"
            class="bi bi-check-lg"
            aria-hidden="true"
          />
          <i
            v-else-if="step.status === 'current'"
            class="bi bi-clock-fill"
            aria-hidden="true"
          />
          <i
            v-else-if="step.status === 'error'"
            class="bi bi-x-lg"
            aria-hidden="true"
          />
          <span
            v-else
            class="timeline-node-number"
          >{{ idx + 1 }}</span>
        </div>

        <!-- Thông tin chữ -->
        <div class="timeline-content ms-3 ms-md-0 text-start text-md-center mt-md-2">
          <div class="timeline-title fw-bold text-dark small">
            {{ step.title }}
          </div>
          <div class="timeline-desc text-muted extra-small">
            {{ step.desc }}
          </div>
          <div
            v-if="step.date"
            class="timeline-date text-primary extra-small fw-semibold mt-0.5"
          >
            {{ step.date }}
          </div>
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.loan-timeline-wrap {
  padding: 0.75rem 0;
}

.loan-timeline-list {
  position: relative;
}

.loan-timeline-step {
  gap: 0.5rem;
  padding-bottom: 1rem;
  z-index: 1;
}

@media (min-width: 768px) {
  .loan-timeline-step {
    flex: 1 1 0;
    padding-bottom: 0;
  }
}

.timeline-node {
  width: 32px;
  height: 32px;
  font-size: 0.85rem;
  font-weight: 600;
  z-index: 2;
  transition: all 0.2s ease;
}

.timeline-node-number {
  font-size: 0.75rem;
}

/* Các trạng thái của Node */
.step-completed .timeline-node {
  background-color: #198754;
  color: #ffffff;
}

.step-current .timeline-node {
  background-color: #0d6efd;
  color: #ffffff;
  box-shadow: 0 0 0 4px rgba(13, 110, 253, 0.2);
}

.step-error .timeline-node {
  background-color: #dc3545;
  color: #ffffff;
}

.step-upcoming .timeline-node {
  background-color: #f8f9fa;
  color: #6c757d;
  border: 2px solid #dee2e6;
}

.step-disabled .timeline-node {
  background-color: #e9ecef;
  color: #adb5bd;
  border: 1px dashed #ced4da;
}

/* Một đường liền chạy qua tâm các mốc trên bố cục ngang. */
.timeline-track {
  position: absolute;
  top: 16px;
  left: 12.5%;
  right: 12.5%;
  height: 2px;
  background-color: #dee2e6;
  z-index: 1;
}

.timeline-track-progress {
  display: block;
  height: 100%;
  background-color: #198754;
}

.extra-small {
  font-size: 0.75rem;
}

.shadow-xs {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
</style>

