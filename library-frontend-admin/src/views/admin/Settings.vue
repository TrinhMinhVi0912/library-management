<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useToast } from 'vue-toastification';
import { getAdminSettings, updateAdminSettings } from '@/services/admin.service';

const toast = useToast();
const loading = ref(false);
const saving = ref(false);
const loadError = ref(false);
const form = reactive({});
const original = ref(null);
const fields = [
  { key: 'maxBooksPerLoan', label: 'Số sách tối đa mỗi phiếu', min: 1, step: 1, group: 'loan' },
  { key: 'loanDays', label: 'Số ngày mượn', min: 1, step: 1, group: 'loan' },
  { key: 'maxRenewals', label: 'Số lần gia hạn tối đa', min: 0, step: 1, group: 'loan' },
  { key: 'renewDays', label: 'Số ngày mỗi lần gia hạn', min: 1, step: 1, group: 'loan' },
  { key: 'pickupHoldDays', label: 'Số ngày giữ sách sau khi duyệt', min: 1, step: 1, group: 'hold' },
  { key: 'reservationHoldDays', label: 'Số ngày giữ sách đặt trước', min: 1, step: 1, group: 'hold' },
  { key: 'lateFeePerDay', label: 'Phạt trả trễ mỗi ngày / quyển (VND)', min: 0, step: 1000, group: 'fine' },
  { key: 'lostBookFeeRate', label: 'Tỷ lệ giá sách phạt khi mất (1 = 100%)', min: 0, step: 0.1, group: 'fine' },
  { key: 'lostBookProcessingFee', label: 'Phí xử lý khi mất sách (VND)', min: 0, step: 1000, group: 'fine' },
];
const formGroups = [
  { key: 'loan', title: 'Chính sách mượn và gia hạn', description: 'Giới hạn sách và thời gian mượn của độc giả.' },
  { key: 'hold', title: 'Thời gian giữ sách', description: 'Số ngày giữ sách đã duyệt và sách được chuyển từ hàng đặt trước.' },
  { key: 'fine', title: 'Mức phạt', description: 'Các mức phạt được áp dụng khi nhân viên ghi nhận trả sách.' },
];
const hasChanges = computed(() => Boolean(original.value)
  && fields.some(({ key }) => Number(form[key]) !== Number(original.value[key])));

onMounted(loadSettings);

function applySettings(settings) {
  fields.forEach(({ key }) => { form[key] = Number(settings[key]); });
  original.value = Object.fromEntries(fields.map(({ key }) => [key, Number(settings[key])]));
}

async function loadSettings() {
  loading.value = true;
  loadError.value = false;
  try {
    const settings = await getAdminSettings();
    if (!settings) throw new Error('Không có dữ liệu cài đặt.');
    applySettings(settings);
  } catch (error) {
    loadError.value = true;
    toast.error(error.response?.data?.message || 'Không tải được cài đặt hệ thống.');
  } finally {
    loading.value = false;
  }
}

function validateSettings() {
  for (const field of fields) {
    const value = Number(form[field.key]);
    if (!Number.isFinite(value) || value < field.min) {
      return `“${field.label}” phải lớn hơn hoặc bằng ${field.min}.`;
    }
    if (field.step === 1 && !Number.isInteger(value)) {
      return `“${field.label}” phải là số nguyên.`;
    }
  }
  return '';
}

async function saveSettings() {
  const validationError = validateSettings();
  if (validationError) {
    toast.error(validationError);
    return;
  }
  if (!hasChanges.value || saving.value) return;
  saving.value = true;
  try {
    const payload = Object.fromEntries(fields.map(({ key }) => [key, Number(form[key])]));
    const updated = await updateAdminSettings(payload);
    applySettings(updated || payload);
    toast.success('Đã lưu cài đặt. Chính sách mới có hiệu lực từ các yêu cầu tiếp theo.');
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể lưu cài đặt.');
  } finally {
    saving.value = false;
  }
}

function resetChanges() {
  if (!original.value) return;
  fields.forEach(({ key }) => { form[key] = original.value[key]; });
}
</script>

<template>
  <section class="settings-page">
    <nav
      class="breadcrumb-line"
      aria-label="Đường dẫn"
    >
      <span>Quản trị</span><i
        class="bi bi-chevron-right"
        aria-hidden="true"
      /><span aria-current="page">Cài đặt</span>
    </nav>
    <div class="page-heading settings-heading">
      <div>
        <h1>Cài đặt hệ thống</h1><p class="text-muted-strong mb-0">
          Chính sách mượn, giữ sách và mức phạt.
        </p>
      </div>
    </div>

    <div
      v-if="loading"
      class="surface-card page-state"
    >
      <span class="spinner-border spinner-border-sm text-primary" /> Đang tải cài đặt...
    </div>
    <div
      v-else-if="loadError"
      class="surface-card page-state error-state"
    >
      Không tải được cài đặt.<button
        class="btn btn-sm btn-outline-primary"
        type="button"
        @click="loadSettings"
      >
        Thử lại
      </button>
    </div>
    <template v-else>
      <div class="settings-notice">
        <i
          class="bi bi-info-circle"
          aria-hidden="true"
        /><span>Thay đổi được áp dụng ngay cho các yêu cầu mượn mới; phiếu đang xử lý không bị tính lại.</span>
      </div>
      <form
        class="settings-form"
        @submit.prevent="saveSettings"
      >
        <section
          v-for="group in formGroups"
          :key="group.key"
          class="surface-card settings-card"
        >
          <header><h2>{{ group.title }}</h2><p>{{ group.description }}</p></header>
          <div class="settings-grid">
            <label
              v-for="field in fields.filter((item) => item.group === group.key)"
              :key="field.key"
              class="form-field"
            >
              <span>{{ field.label }}</span>
              <input
                v-model.number="form[field.key]"
                class="form-control"
                type="number"
                :min="field.min"
                :step="field.step"
                required
              >
            </label>
          </div>
        </section>
        <footer class="settings-actions">
          <span
            v-if="hasChanges"
            class="unsaved-note"
          ><i
            class="bi bi-exclamation-circle"
            aria-hidden="true"
          /> Có thay đổi chưa lưu</span><button
            class="btn btn-outline-secondary"
            type="button"
            :disabled="!hasChanges || saving"
            @click="resetChanges"
          >
            Hoàn tác
          </button><button
            class="btn btn-primary"
            type="submit"
            :disabled="!hasChanges || saving"
          >
            <span
              v-if="saving"
              class="spinner-border spinner-border-sm me-1"
              aria-hidden="true"
            />Lưu cài đặt
          </button>
        </footer>
      </form>
    </template>
  </section>
</template>

<style scoped lang="scss">
.breadcrumb-line { display: flex; align-items: center; gap: .5rem; margin-bottom: 1rem; color: #6b7280; font-size: .825rem; }.settings-heading { margin-bottom: 1.25rem; }.settings-heading p { margin-top: .35rem; font-size: .9rem; }
.settings-notice { display: flex; align-items: flex-start; gap: .55rem; margin-bottom: 1rem; padding: .8rem 1rem; border: 1px solid #bfdbfe; border-radius: .65rem; background: #eff6ff; color: #1e40af; font-size: .85rem; }
.settings-form { display: grid; gap: 1rem; }.settings-card { padding: 1.2rem 1.35rem; }.settings-card header { margin-bottom: 1rem; }.settings-card h2 { margin: 0; font-size: 1rem; }.settings-card p { margin: .35rem 0 0; color: #6b7280; font-size: .8rem; }.settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .9rem 1rem; }.form-field { display: grid; gap: .35rem; font-size: .85rem; }.settings-actions { display: flex; align-items: center; justify-content: flex-end; gap: .6rem; }.unsaved-note { margin-right: auto; color: #b45309; font-size: .8rem; }.page-state { display: flex; min-height: 180px; align-items: center; justify-content: center; gap: .6rem; }.error-state { flex-direction: column; color: #6b7280; }
@media (max-width: 575.98px) { .settings-grid { grid-template-columns: 1fr; }.settings-card { padding: 1rem; }.settings-actions { flex-wrap: wrap; }.unsaved-note { width: 100%; } }
</style>
