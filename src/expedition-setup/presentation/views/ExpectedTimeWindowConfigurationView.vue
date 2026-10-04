<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  ExpectedTimeWindow,
} from '../../domain/model/expected-time-window.entity.js';
import useExpeditionSetupStore from '../../application/expedition-setup.store.js';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const store = useExpeditionSetupStore();

const routeId = Number(route.params.routeId);

const selectedSegment = ref(null);
const submissionErrorKey = ref('');

const form = reactive({
  minimumMinutes: null,
  maximumMinutes: null,
});

const fieldErrors = reactive({
  minimumMinutes: '',
  maximumMinutes: '',
});

const selectedRoute = computed(() => (
    store.routes.find((currentRoute) => currentRoute.id === routeId)
));

const segments = computed(() => (
    store.getRouteSegments(routeId)
));

const pendingSegments = computed(() => (
    store.getPendingSegmentsByRouteId(routeId)
));

const isLoading = computed(() => (
    !store.routesLoaded
    || !store.checkpointsLoaded
    || !store.expectedTimeWindowsLoaded
));

function selectSegment(segment) {
  selectedSegment.value = segment;
  submissionErrorKey.value = '';
  fieldErrors.minimumMinutes = '';
  fieldErrors.maximumMinutes = '';
  form.minimumMinutes = null;
  form.maximumMinutes = null;
}

function validateForm() {
  fieldErrors.minimumMinutes = '';
  fieldErrors.maximumMinutes = '';

  if (
      !Number.isFinite(form.minimumMinutes)
      || form.minimumMinutes < 0
  ) {
    fieldErrors.minimumMinutes = 'validation.minimumTimeInvalid';
  }

  if (
      !Number.isFinite(form.maximumMinutes)
      || form.maximumMinutes <= form.minimumMinutes
  ) {
    fieldErrors.maximumMinutes = 'validation.maximumTimeInvalid';
  }

  return !fieldErrors.minimumMinutes && !fieldErrors.maximumMinutes;
}

function saveExpectedTimeWindow() {
  submissionErrorKey.value = '';
  store.clearErrors();

  if (!selectedSegment.value || !validateForm()) {
    return;
  }

  const expectedTimeWindow = new ExpectedTimeWindow({
    routeId,
    fromCheckpointId: selectedSegment.value.fromCheckpoint.id,
    toCheckpointId: selectedSegment.value.toCheckpoint.id,
    minimumMinutes: form.minimumMinutes,
    maximumMinutes: form.maximumMinutes,
  });

  store.addExpectedTimeWindow(expectedTimeWindow)
      .then((newExpectedTimeWindow) => {
        if (newExpectedTimeWindow) {
          selectedSegment.value = null;
          form.minimumMinutes = null;
          form.maximumMinutes = null;
          return;
        }

        submissionErrorKey.value = store.errors.at(-1)?.code
            ?? 'errors.expectedTimeWindowCreationFailed';
      });
}

function goBackToRoutes() {
  router.push({ name: 'routes' });
}

onMounted(() => {
  Promise.all([
    store.fetchRoutes(),
    store.fetchCheckpoints(),
    store.fetchExpectedTimeWindows(),
  ]).then(() => {
    if (!selectedRoute.value) {
      goBackToRoutes();
    }
  });
});
</script>

<template>
  <section v-if="selectedRoute" class="time-windows-view">
    <header class="view-header">
      <div>
        <p class="eyebrow">
          {{ t('expectedTimeWindows.title') }} / {{ selectedRoute.name }}
        </p>

        <h1>{{ t('expectedTimeWindows.title') }}</h1>
        <p>{{ t('expectedTimeWindows.description') }}</p>
      </div>

      <pv-button
          :label="t('common.backToRoutes')"
          icon="pi pi-arrow-left"
          severity="secondary"
          outlined
          @click="goBackToRoutes"
      />
    </header>

    <p v-if="isLoading" class="loading-message">
      {{ t('common.loading') }}
    </p>

    <template v-else>
      <article class="route-context-card">
        <div>
          <span class="route-context-label">
            {{ t('checkpoints.route') }}
          </span>

          <h2>{{ selectedRoute.name }}</h2>
          <p>
            {{ selectedRoute.origin }} → {{ selectedRoute.destination }}
          </p>
        </div>

        <span
            class="segments-summary"
            :class="{ complete: pendingSegments.length === 0 && segments.length }"
        >
          <i class="pi pi-clock" />

          {{
            pendingSegments.length
                ? t('expectedTimeWindows.pendingCount', {
                  count: pendingSegments.length,
                })
                : t('expectedTimeWindows.allConfigured')
          }}
        </span>
      </article>

      <section
          v-if="selectedSegment"
          class="window-form-card"
      >
        <div class="section-heading">
          <span class="section-icon">
            <i class="pi pi-clock" />
          </span>

          <div>
            <h2>{{ t('expectedTimeWindows.title') }}</h2>
            <p>
              {{ selectedSegment.fromCheckpoint.location }}
              →
              {{ selectedSegment.toCheckpoint.location }}
            </p>
          </div>
        </div>

        <form @submit.prevent="saveExpectedTimeWindow">
          <div class="form-grid">
            <div class="form-field">
              <label for="minimum-minutes">
                {{ t('expectedTimeWindows.minimumMinutes') }}
              </label>

              <pv-input-number
                  id="minimum-minutes"
                  v-model="form.minimumMinutes"
                  :min="0"
                  :use-grouping="false"
                  :invalid="Boolean(fieldErrors.minimumMinutes)"
                  fluid
              />

              <small
                  v-if="fieldErrors.minimumMinutes"
                  class="field-error"
              >
                {{ t(fieldErrors.minimumMinutes) }}
              </small>
            </div>

            <div class="form-field">
              <label for="maximum-minutes">
                {{ t('expectedTimeWindows.maximumMinutes') }}
              </label>

              <pv-input-number
                  id="maximum-minutes"
                  v-model="form.maximumMinutes"
                  :min="0"
                  :use-grouping="false"
                  :invalid="Boolean(fieldErrors.maximumMinutes)"
                  fluid
              />

              <small
                  v-if="fieldErrors.maximumMinutes"
                  class="field-error"
              >
                {{ t(fieldErrors.maximumMinutes) }}
              </small>
            </div>
          </div>

          <p v-if="submissionErrorKey" class="request-error">
            {{ t(submissionErrorKey) }}
          </p>

          <div class="form-actions">
            <pv-button
                type="button"
                :label="t('common.cancel')"
                severity="secondary"
                outlined
                @click="selectedSegment = null"
            />

            <pv-button
                type="submit"
                :label="t('expectedTimeWindows.save')"
                icon="pi pi-save"
            />
          </div>
        </form>
      </section>

      <section class="segments-card">
        <div class="segments-header">
          <div>
            <h2>{{ t('expectedTimeWindows.segment') }}</h2>
            <p>{{ t('expectedTimeWindows.description') }}</p>
          </div>

          <i class="pi pi-directions segments-icon" />
        </div>

        <div v-if="segments.length" class="segments-list">
          <article
              v-for="(segment, index) in segments"
              :key="`${segment.fromCheckpoint.id}-${segment.toCheckpoint.id}`"
              class="segment-item"
          >
            <span class="segment-order">{{ index + 1 }}</span>

            <div class="segment-route">
              <strong>{{ segment.fromCheckpoint.location }}</strong>
              <i class="pi pi-arrow-right" />
              <strong>{{ segment.toCheckpoint.location }}</strong>
            </div>

            <div
                v-if="segment.expectedTimeWindow"
                class="segment-status configured"
            >
              <span>
                <i class="pi pi-check-circle" />
                {{ t('expectedTimeWindows.configured') }}
              </span>

              <strong>
                {{ segment.expectedTimeWindow.minimumMinutes }}
                –
                {{ segment.expectedTimeWindow.maximumMinutes }}
                min
              </strong>
            </div>

            <div v-else class="segment-status">
              <span>
                <i class="pi pi-clock" />
                {{ t('expectedTimeWindows.pending') }}
              </span>

              <pv-button
                  :label="t('common.configureTimeWindows')"
                  size="small"
                  outlined
                  @click="selectSegment(segment)"
              />
            </div>
          </article>
        </div>

        <div v-else class="empty-state">
          <i class="pi pi-directions" />
          <h3>{{ t('expectedTimeWindows.noSegments') }}</h3>
          <p>{{ t('expectedTimeWindows.noSegmentsDescription') }}</p>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.time-windows-view {
  max-width: 1120px;
  margin: 0 auto;
  padding: 3rem 2rem;
}

.view-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.eyebrow,
.route-context-label {
  margin: 0 0 0.55rem;
  color: var(--vt-teal);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1,
h2,
h3 {
  color: var(--vt-text);
}

.view-header h1 {
  margin-bottom: 0.55rem;
  font-size: clamp(2.1rem, 4vw, 3rem);
}

.view-header p,
.route-context-card p,
.section-heading p,
.segments-header p,
.empty-state p {
  color: var(--vt-muted);
}

.loading-message {
  color: var(--vt-muted);
}

.route-context-card,
.window-form-card,
.segments-card {
  border: 1px solid var(--vt-border);
  border-radius: 1.1rem;
  background: #ffffff;
  box-shadow: 0 0.75rem 1.8rem rgb(15 41 55 / 6%);
}

.route-context-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  padding: 1.5rem;
}

.route-context-card h2 {
  margin-bottom: 0.45rem;
  font-size: 1.3rem;
}

.segments-summary {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.7rem 0.85rem;
  border-radius: 0.6rem;
  background: #fff4dc;
  color: #9b5b00;
  font-size: 0.82rem;
  font-weight: 700;
}

.segments-summary.complete {
  background: #e6f8ef;
  color: #157347;
}

.window-form-card,
.segments-card {
  margin-bottom: 1.5rem;
  padding: 1.5rem;
}

.section-heading {
  display: flex;
  gap: 0.85rem;
  margin-bottom: 1.6rem;
}

.section-heading h2,
.segments-header h2 {
  margin-bottom: 0.35rem;
  font-size: 1.25rem;
}

.section-icon {
  display: grid;
  width: 2.7rem;
  height: 2.7rem;
  place-items: center;
  border-radius: 0.75rem;
  background: #e7f8f8;
  color: var(--vt-teal);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.form-field {
  display: grid;
  gap: 0.45rem;
}

.form-field label {
  color: var(--vt-text);
  font-size: 0.87rem;
  font-weight: 700;
}

.field-error,
.request-error {
  color: #b42318;
  font-size: 0.8rem;
}

.request-error {
  margin: 1rem 0 0;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.segments-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 1.2rem;
  border-bottom: 1px solid var(--vt-border);
}

.segments-icon {
  color: var(--vt-teal);
  font-size: 1.35rem;
}

.segments-list {
  display: grid;
}

.segment-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--vt-border);
}

.segment-item:last-child {
  border-bottom: 0;
}

.segment-order {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 999px;
  background: var(--vt-teal);
  color: #ffffff;
  font-size: 0.82rem;
  font-weight: 800;
}

.segment-route {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--vt-text);
}

.segment-route i {
  color: var(--vt-teal);
  font-size: 0.78rem;
}

.segment-status {
  display: grid;
  justify-items: end;
  gap: 0.5rem;
  color: #9b5b00;
  font-size: 0.82rem;
  font-weight: 700;
}

.segment-status span {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.segment-status.configured {
  color: #157347;
}

.empty-state {
  padding: 3.5rem 1rem;
  text-align: center;
}

.empty-state i {
  margin-bottom: 0.9rem;
  color: var(--vt-teal);
  font-size: 2rem;
}

.empty-state h3 {
  margin-bottom: 0.4rem;
}

.empty-state p {
  margin-bottom: 0;
}

@media (max-width: 760px) {
  .time-windows-view {
    padding: 2rem 1.25rem;
  }

  .view-header,
  .route-context-card {
    align-items: stretch;
    flex-direction: column;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .segment-item {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .segment-status {
    grid-column: 1 / -1;
    justify-items: start;
    padding-left: 3rem;
  }
}
</style>