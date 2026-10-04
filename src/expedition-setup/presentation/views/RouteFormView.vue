<script setup>
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Route } from '../../domain/model/route.entity.js';
import useExpeditionSetupStore from '../../application/expedition-setup.store.js';

const router = useRouter();
const { t } = useI18n();
const store = useExpeditionSetupStore();

const form = reactive({
  name: '',
  origin: '',
  destination: '',
  distanceKm: null,
  elevationGainMeters: null,
  difficulty: null,
  estimatedDurationHours: null,
});

const fieldErrors = ref({});
const submissionErrorKey = ref('');
const isSubmitting = ref(false);

const difficulties = computed(() => [
  { label: t('routes.difficulty.Beginner'), value: 'Beginner' },
  { label: t('routes.difficulty.Intermediate'), value: 'Intermediate' },
  { label: t('routes.difficulty.Advanced'), value: 'Advanced' },
  { label: t('routes.difficulty.Expert'), value: 'Expert' },
]);

function validateForm() {
  const errors = {};

  if (!form.name.trim()) errors.name = 'validation.routeNameRequired';
  if (!form.origin.trim()) errors.origin = 'validation.originRequired';
  if (!form.destination.trim()) errors.destination = 'validation.destinationRequired';

  if (!Number.isFinite(form.distanceKm) || form.distanceKm <= 0) {
    errors.distanceKm = 'validation.distanceInvalid';
  }

  if (!Number.isFinite(form.elevationGainMeters) || form.elevationGainMeters < 0) {
    errors.elevationGainMeters = 'validation.elevationInvalid';
  }

  if (!form.difficulty) errors.difficulty = 'validation.difficultyRequired';

  if (!Number.isFinite(form.estimatedDurationHours) || form.estimatedDurationHours <= 0) {
    errors.estimatedDurationHours = 'validation.durationInvalid';
  }

  fieldErrors.value = errors;
  return Object.keys(errors).length === 0;
}

async function saveRoute() {
  submissionErrorKey.value = '';

  if (!validateForm()) {
    return;
  }

  isSubmitting.value = true;

  const route = new Route({
    name: form.name.trim(),
    origin: form.origin.trim(),
    destination: form.destination.trim(),
    distanceKm: form.distanceKm,
    elevationGainMeters: form.elevationGainMeters,
    difficulty: form.difficulty,
    estimatedDurationMinutes: form.estimatedDurationHours * 60,
    status: 'draft',
  });

  const createdRoute = await store.addRoute(route);

  isSubmitting.value = false;

  if (!createdRoute) {
    submissionErrorKey.value = store.errors.at(-1)?.code
        ?? 'errors.routeCreationFailed';
    return;
  }

  router.push({ name: 'routes' });
}

function cancel() {
  router.push({ name: 'routes' });
}
</script>

<template>
  <section class="route-form-page">
    <header class="form-page-header">
      <button type="button" class="back-link" @click="cancel">
        <i class="pi pi-arrow-left" aria-hidden="true" />
        {{ t('common.backToRoutes') }}
      </button>

      <p class="eyebrow">EXPEDITION SETUP / ROUTE CONFIGURATION</p>
      <h1>{{ t('routeForm.title') }}</h1>
      <p class="header-description">{{ t('routeForm.description') }}</p>
    </header>

    <form class="route-form-card" @submit.prevent="saveRoute">
      <section class="form-section">
        <div class="section-heading">
          <div class="section-icon">
            <i class="pi pi-map" aria-hidden="true" />
          </div>

          <div>
            <h2>{{ t('routeForm.identityTitle') }}</h2>
            <p>{{ t('routeForm.identityDescription') }}</p>
          </div>
        </div>

        <div class="field-grid">
          <div class="form-field field-full">
            <label for="name">{{ t('routeForm.routeName') }}</label>
            <pv-input-text
                id="name"
                v-model="form.name"
                :invalid="Boolean(fieldErrors.name)"
                :placeholder="t('routeForm.routeNamePlaceholder')"
                class="w-full"
            />
            <small v-if="fieldErrors.name" class="field-error">
              <i class="pi pi-exclamation-circle" aria-hidden="true" />
              {{ t(fieldErrors.name) }}
            </small>
          </div>

          <div class="form-field">
            <label for="difficulty">{{ t('routes.difficultyFilter') }}</label>
            <pv-select
                id="difficulty"
                v-model="form.difficulty"
                :options="difficulties"
                option-label="label"
                option-value="value"
                :placeholder="t('routeForm.difficultyPlaceholder')"
                :invalid="Boolean(fieldErrors.difficulty)"
                class="w-full"
            />
            <small v-if="fieldErrors.difficulty" class="field-error">
              <i class="pi pi-exclamation-circle" aria-hidden="true" />
              {{ t(fieldErrors.difficulty) }}
            </small>
          </div>
        </div>
      </section>

      <section class="form-section">
        <div class="section-heading">
          <div class="section-icon">
            <i class="pi pi-compass" aria-hidden="true" />
          </div>

          <div>
            <h2>{{ t('routeForm.geographicTitle') }}</h2>
            <p>{{ t('routeForm.geographicDescription') }}</p>
          </div>
        </div>

        <div class="field-grid">
          <div class="form-field">
            <label for="origin">{{ t('routes.origin') }}</label>
            <pv-input-text
                id="origin"
                v-model="form.origin"
                :invalid="Boolean(fieldErrors.origin)"
                :placeholder="t('routeForm.originPlaceholder')"
                class="w-full"
            />
            <small v-if="fieldErrors.origin" class="field-error">
              <i class="pi pi-exclamation-circle" aria-hidden="true" />
              {{ t(fieldErrors.origin) }}
            </small>
          </div>

          <div class="form-field">
            <label for="destination">{{ t('routes.destination') }}</label>
            <pv-input-text
                id="destination"
                v-model="form.destination"
                :invalid="Boolean(fieldErrors.destination)"
                :placeholder="t('routeForm.destinationPlaceholder')"
                class="w-full"
            />
            <small v-if="fieldErrors.destination" class="field-error">
              <i class="pi pi-exclamation-circle" aria-hidden="true" />
              {{ t(fieldErrors.destination) }}
            </small>
          </div>

          <div class="form-field">
            <label for="distance">{{ t('routeForm.distanceKm') }}</label>
            <pv-input-number
                id="distance"
                v-model="form.distanceKm"
                :min="0.1"
                :min-fraction-digits="1"
                :max-fraction-digits="1"
                :invalid="Boolean(fieldErrors.distanceKm)"
                class="w-full"
            />
            <small v-if="fieldErrors.distanceKm" class="field-error">
              <i class="pi pi-exclamation-circle" aria-hidden="true" />
              {{ t(fieldErrors.distanceKm) }}
            </small>
          </div>

          <div class="form-field">
            <label for="elevation">{{ t('routeForm.elevationGainMeters') }}</label>
            <pv-input-number
                id="elevation"
                v-model="form.elevationGainMeters"
                :min="0"
                :invalid="Boolean(fieldErrors.elevationGainMeters)"
                class="w-full"
            />
            <small v-if="fieldErrors.elevationGainMeters" class="field-error">
              <i class="pi pi-exclamation-circle" aria-hidden="true" />
              {{ t(fieldErrors.elevationGainMeters) }}
            </small>
          </div>
        </div>
      </section>

      <section class="form-section">
        <div class="section-heading">
          <div class="section-icon">
            <i class="pi pi-clock" aria-hidden="true" />
          </div>

          <div>
            <h2>{{ t('routeForm.operationalTitle') }}</h2>
            <p>{{ t('routeForm.operationalDescription') }}</p>
          </div>
        </div>

        <div class="field-grid">
          <div class="form-field">
            <label for="duration">
              {{ t('routeForm.estimatedDurationHours') }}
            </label>
            <pv-input-number
                id="duration"
                v-model="form.estimatedDurationHours"
                :min="1"
                :invalid="Boolean(fieldErrors.estimatedDurationHours)"
                class="w-full"
            />
            <small v-if="fieldErrors.estimatedDurationHours" class="field-error">
              <i class="pi pi-exclamation-circle" aria-hidden="true" />
              {{ t(fieldErrors.estimatedDurationHours) }}
            </small>
          </div>
        </div>
      </section>

      <p v-if="submissionErrorKey" class="submission-error">
        <i class="pi pi-exclamation-triangle" aria-hidden="true" />
        {{ t(submissionErrorKey) }}
      </p>

      <footer class="form-actions">
        <pv-button
            type="button"
            :label="t('common.cancel')"
            severity="secondary"
            @click="cancel"
        />

        <pv-button
            type="submit"
            :label="t('common.saveRoute')"
            icon="pi pi-save"
            :loading="isSubmitting"
        />
      </footer>
    </form>
  </section>
</template>

<style scoped>
.route-form-page {
  width: min(100%, 62rem);
  margin: 0 auto;
}

.form-page-header {
  margin-bottom: 1.5rem;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--vt-teal);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.eyebrow {
  margin: 0 0 0.5rem;
  color: var(--vt-teal);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

h1 {
  margin: 0;
  color: var(--vt-text);
  font-size: clamp(2rem, 4vw, 2.5rem);
}

.header-description {
  max-width: 42rem;
  margin: 0.75rem 0 0;
  color: var(--vt-muted);
  line-height: 1.55;
}

.route-form-card {
  overflow: hidden;
  border: 1px solid var(--vt-border);
  border-radius: var(--vt-radius-card);
  background: var(--vt-surface);
  box-shadow: var(--vt-shadow);
}

.form-section {
  padding: 1.75rem;
  border-bottom: 1px solid var(--vt-border);
}

.section-heading {
  display: flex;
  gap: 0.875rem;
  margin-bottom: 1.5rem;
}

.section-icon {
  display: grid;
  flex: 0 0 auto;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border-radius: 0.75rem;
  background: #e7f8f8;
  color: var(--vt-teal);
}

.section-heading h2,
.section-heading p {
  margin: 0;
}

.section-heading h2 {
  font-size: 1.1rem;
}

.section-heading p {
  margin-top: 0.25rem;
  color: var(--vt-muted);
  font-size: 0.9rem;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
}

.field-full {
  grid-column: 1 / -1;
}

.form-field label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--vt-text);
  font-size: 0.9rem;
  font-weight: 700;
}

.field-error,
.submission-error {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.5rem;
  color: var(--vt-danger);
  font-size: 0.8rem;
  font-weight: 700;
}

.submission-error {
  margin: 1.25rem 1.75rem 0;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.25rem 1.75rem;
  background: #fbfcfb;
}

@media (max-width: 700px) {
  .form-section {
    padding: 1.25rem;
  }

  .field-grid {
    grid-template-columns: 1fr;
  }

  .field-full {
    grid-column: auto;
  }

  .form-actions {
    flex-direction: column-reverse;
    padding: 1.25rem;
  }
}
</style>