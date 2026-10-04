<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Checkpoint } from '../../domain/model/checkpoint.entity.js';
import useExpeditionSetupStore from '../../application/expedition-setup.store.js';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const store = useExpeditionSetupStore();

const routeId = Number(route.params.routeId);

const form = reactive({
  location: '',
  sequenceOrder: null,
});

const fieldErrors = reactive({
  location: '',
  sequenceOrder: '',
});

const submissionErrorKey = ref('');
const enableErrorKey = ref('');
const selectedRoute = computed(() => (
    store.routes.find((currentRoute) => currentRoute.id === routeId)
));

const checkpoints = computed(() => (
    store.getCheckpointsByRouteId(routeId)
));

const hasCheckpoints = computed(() => (
    store.routeHasCheckpoints(routeId)
));
const isRouteEnabled = computed(() => (
    selectedRoute.value?.status === 'enabled'
));
const isLoading = computed(() => (
    !store.routesLoaded || !store.checkpointsLoaded
));

function validateForm() {
  fieldErrors.location = '';
  fieldErrors.sequenceOrder = '';

  if (!form.location.trim()) {
    fieldErrors.location = 'validation.checkpointLocationRequired';
  }

  if (
      !Number.isInteger(form.sequenceOrder)
      || form.sequenceOrder <= 0
  ) {
    fieldErrors.sequenceOrder = 'validation.checkpointOrderInvalid';
  }

  return !fieldErrors.location && !fieldErrors.sequenceOrder;
}

function resetForm() {
  form.location = '';
  form.sequenceOrder = null;
}

function submitForm() {
  submissionErrorKey.value = '';
  store.clearErrors();

  if (!validateForm()) {
    return;
  }

  const checkpoint = new Checkpoint({
    routeId,
    location: form.location.trim(),
    sequenceOrder: form.sequenceOrder,
  });

  store.addCheckpoint(checkpoint)
      .then((newCheckpoint) => {
        if (newCheckpoint) {
          resetForm();
          return;
        }

        submissionErrorKey.value = store.errors.at(-1)?.code
            ?? 'errors.checkpointCreationFailed';
      });
}

function enableCurrentRoute() {
  enableErrorKey.value = '';
  store.clearErrors();

  store.enableRoute(routeId)
      .then((enabledRoute) => {
        if (!enabledRoute) {
          enableErrorKey.value = store.errors.at(-1)?.code
              ?? 'errors.routeEnableFailed';
        }
      });
}

function goBackToRoutes() {
  router.push({ name: 'routes' });
}

onMounted(() => {
  Promise.all([
    store.fetchRoutes(),
    store.fetchCheckpoints(),
  ]).then(() => {
    if (!selectedRoute.value) {
      goBackToRoutes();
    }
  });
});
</script>

<template>
  <section v-if="selectedRoute" class="checkpoint-configuration-view">
    <header class="view-header">
      <div>
        <p class="eyebrow">
          {{ t('checkpoints.title') }} / {{ selectedRoute.name }}
        </p>

        <h1>{{ t('checkpoints.title') }}</h1>
        <p>{{ t('checkpoints.description') }}</p>
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

        <div class="route-actions">
  <span
      class="route-state"
      :class="{ ready: hasCheckpoints }"
  >
    <i
        class="pi"
        :class="
        isRouteEnabled
          ? 'pi-check-circle'
          : hasCheckpoints
            ? 'pi-check-circle'
            : 'pi-info-circle'
      "
    />

    {{
      isRouteEnabled
          ? t('checkpoints.routeEnabled')
          : hasCheckpoints
              ? t('checkpoints.routeReady')
              : t('checkpoints.routePending')
    }}
  </span>

          <pv-button
              v-if="!isRouteEnabled"
              type="button"
              :label="t('checkpoints.enableRoute')"
              icon="pi pi-check"
              @click="enableCurrentRoute"
          />

          <small v-if="enableErrorKey" class="field-error">
            {{ t(enableErrorKey) }}
          </small>
        </div>
      </article>

      <div class="checkpoint-content">
        <form class="checkpoint-form-card" @submit.prevent="submitForm">
          <div class="section-heading">
            <span class="section-icon">
              <i class="pi pi-map-marker" />
            </span>

            <div>
              <h2>{{ t('checkpoints.addCheckpoint') }}</h2>
              <p>{{ t('checkpoints.description') }}</p>
            </div>
          </div>

          <div class="form-field">
            <label for="checkpoint-location">
              {{ t('checkpoints.location') }}
            </label>

            <pv-input-text
                id="checkpoint-location"
                v-model.trim="form.location"
                :placeholder="t('checkpoints.locationPlaceholder')"
                :invalid="Boolean(fieldErrors.location)"
                fluid
            />

            <small
                v-if="fieldErrors.location"
                class="field-error"
            >
              {{ t(fieldErrors.location) }}
            </small>
          </div>

          <div class="form-field">
            <label for="checkpoint-sequence-order">
              {{ t('checkpoints.sequenceOrder') }}
            </label>

            <pv-input-number
                id="checkpoint-sequence-order"
                v-model="form.sequenceOrder"
                :min="1"
                :use-grouping="false"
                :invalid="Boolean(fieldErrors.sequenceOrder)"
                fluid
            />

            <small
                v-if="fieldErrors.sequenceOrder"
                class="field-error"
            >
              {{ t(fieldErrors.sequenceOrder) }}
            </small>
          </div>

          <p v-if="submissionErrorKey" class="request-error">
            {{ t(submissionErrorKey) }}
          </p>

          <pv-button
              type="submit"
              :label="t('checkpoints.addCheckpoint')"
              icon="pi pi-plus"
          />
        </form>

        <section class="checkpoint-list-card">
          <div class="checkpoint-list-header">
            <div>
              <h2>{{ t('checkpoints.title') }}</h2>
              <p>
                {{
                  t('checkpoints.registeredCount', {
                    count: checkpoints.length,
                  })
                }}
              </p>
            </div>

            <i class="pi pi-list-ol list-icon" />
          </div>

          <div v-if="checkpoints.length" class="checkpoint-list">
            <article
                v-for="checkpoint in checkpoints"
                :key="checkpoint.id"
                class="checkpoint-item"
            >
              <span class="sequence-badge">
                {{ checkpoint.sequenceOrder }}
              </span>

              <div>
                <strong>{{ checkpoint.location }}</strong>
                <p>
                  {{
                    t('checkpoints.sequence', {
                      order: checkpoint.sequenceOrder,
                    })
                  }}
                </p>
              </div>
            </article>
          </div>

          <div v-else class="empty-state">
            <i class="pi pi-map-marker" />
            <h3>{{ t('checkpoints.noCheckpoints') }}</h3>
            <p>{{ t('checkpoints.noCheckpointsDescription') }}</p>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.checkpoint-configuration-view {
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
.checkpoint-list-header p,
.checkpoint-item p,
.empty-state p {
  color: var(--vt-muted);
}

.loading-message {
  color: var(--vt-muted);
}

.route-context-card,
.checkpoint-form-card,
.checkpoint-list-card {
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

.route-state {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  max-width: 23rem;
  padding: 0.7rem 0.85rem;
  border-radius: 0.6rem;
  background: #fff4dc;
  color: #9b5b00;
  font-size: 0.82rem;
  font-weight: 700;
}

.route-state.ready {
  background: #e6f8ef;
  color: #157347;
}

.checkpoint-content {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 1.5rem;
}

.checkpoint-form-card,
.checkpoint-list-card {
  padding: 1.5rem;
}

.section-heading {
  display: flex;
  gap: 0.85rem;
  margin-bottom: 1.6rem;
}

.section-heading h2,
.checkpoint-list-header h2 {
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

.form-field {
  display: grid;
  gap: 0.45rem;
  margin-bottom: 1.15rem;
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
  margin: 0 0 1rem;
}

.checkpoint-list-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 1.2rem;
  border-bottom: 1px solid var(--vt-border);
}

.list-icon {
  color: var(--vt-teal);
  font-size: 1.35rem;
}

.checkpoint-list {
  display: grid;
}

.checkpoint-item {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--vt-border);
}

.checkpoint-item:last-child {
  border-bottom: 0;
}

.checkpoint-item strong {
  color: var(--vt-text);
}

.checkpoint-item p {
  margin: 0.25rem 0 0;
  font-size: 0.82rem;
}

.sequence-badge {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 999px;
  background: var(--vt-teal);
  color: #ffffff;
  font-size: 0.82rem;
  font-weight: 800;
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
  .route-actions {
    justify-items: start;
  }

  .checkpoint-configuration-view {
    padding: 2rem 1.25rem;
  }

  .view-header,
  .route-context-card {
    align-items: stretch;
    flex-direction: column;
  }

  .checkpoint-content {
    grid-template-columns: 1fr;
  }

  .route-state {
    max-width: none;
  }
}
.route-actions {
  display: grid;
  justify-items: end;
  gap: 0.7rem;
}

</style>