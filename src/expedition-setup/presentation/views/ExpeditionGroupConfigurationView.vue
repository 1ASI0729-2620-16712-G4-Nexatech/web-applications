<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ExpeditionGroup } from '../../domain/model/expedition-group.entity.js';
import useExpeditionSetupStore from '../../application/expedition-setup.store.js';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const store = useExpeditionSetupStore();

const routeId = Number(route.params.routeId);

const form = reactive({
  name: '',
  departureDate: '',
  maximumCapacity: null,
});

const fieldErrors = reactive({
  name: '',
  departureDate: '',
  maximumCapacity: '',
});

const submissionErrorKey = ref('');

const guideAssignmentGroupId = ref(null);
const guideAssignmentFieldGuideId = ref(null);
const guideAssignmentFieldError = ref('');
const guideAssignmentSubmissionError = ref('');
const guideAssignmentConflict = ref(false);

const selectedRoute = computed(() => (
    store.routes.find((currentRoute) => currentRoute.id === routeId)
));

const expeditionGroups = computed(() => (
    store.getExpeditionGroupsByRouteId(routeId)
));

const isRouteEnabled = computed(() => (
    selectedRoute.value?.status === 'enabled'
));

const isLoading = computed(() => (
    !store.routesLoaded
    || !store.expeditionGroupsLoaded
    || !store.fieldGuidesLoaded
));

function validateForm() {
  fieldErrors.name = '';
  fieldErrors.departureDate = '';
  fieldErrors.maximumCapacity = '';

  if (!form.name.trim()) {
    fieldErrors.name = 'validation.expeditionGroupNameRequired';
  }

  if (!form.departureDate) {
    fieldErrors.departureDate = 'validation.expeditionGroupDepartureDateRequired';
  }

  if (
      !Number.isInteger(form.maximumCapacity)
      || form.maximumCapacity <= 0
  ) {
    fieldErrors.maximumCapacity = 'validation.expeditionGroupCapacityInvalid';
  }

  return !fieldErrors.name
      && !fieldErrors.departureDate
      && !fieldErrors.maximumCapacity;
}

function resetForm() {
  form.name = '';
  form.departureDate = '';
  form.maximumCapacity = null;
}

function submitForm() {
  submissionErrorKey.value = '';
  store.clearErrors();

  if (!validateForm()) {
    return;
  }

  const expeditionGroup = new ExpeditionGroup({
    routeId,
    name: form.name.trim(),
    departureDate: form.departureDate,
    maximumCapacity: form.maximumCapacity,
  });

  store.addExpeditionGroup(expeditionGroup)
      .then((newExpeditionGroup) => {
        if (newExpeditionGroup) {
          resetForm();
          return;
        }

        submissionErrorKey.value = store.errors.at(-1)?.code
            ?? 'errors.expeditionGroupCreationFailed';
      });
}

function goBackToRoutes() {
  router.push({ name: 'routes' });
}



function getFieldGuideName(fieldGuideId) {
  return store.fieldGuides.find((fieldGuide) => (
      fieldGuide.id === fieldGuideId
  ))?.name ?? '';
}

function openGuideAssignment(expeditionGroup) {
  guideAssignmentGroupId.value = expeditionGroup.id;
  guideAssignmentFieldGuideId.value = expeditionGroup.fieldGuideId;
  guideAssignmentFieldError.value = '';
  guideAssignmentSubmissionError.value = '';
  guideAssignmentConflict.value = false;
}

function closeGuideAssignment() {
  guideAssignmentGroupId.value = null;
}

function submitGuideAssignment(confirmConflict = false) {
  guideAssignmentFieldError.value = '';
  guideAssignmentSubmissionError.value = '';
  store.clearErrors();

  if (!guideAssignmentFieldGuideId.value) {
    guideAssignmentFieldError.value = 'validation.fieldGuideRequired';
    return;
  }

  store.assignFieldGuide(
      guideAssignmentGroupId.value,
      guideAssignmentFieldGuideId.value,
      confirmConflict,
  ).then((result) => {
    if (result?.conflict) {
      guideAssignmentConflict.value = true;
      return;
    }

    if (!result) {
      guideAssignmentSubmissionError.value = store.errors.at(-1)?.code
          ?? 'errors.fieldGuideAssignmentFailed';
      return;
    }

    closeGuideAssignment();
  });
}

onMounted(() => {
  Promise.all([
    store.fetchRoutes(),
    store.fetchExpeditionGroups(),
    store.fetchFieldGuides(),
  ]).then(() => {
    if (!selectedRoute.value) {
      goBackToRoutes();
    }
  });
});
</script>

<template>
  <section v-if="selectedRoute" class="expedition-group-configuration-view">
    <header class="view-header">
      <div>
        <p class="eyebrow">
          {{ t('expeditionGroups.title') }} / {{ selectedRoute.name }}
        </p>

        <h1>{{ t('expeditionGroups.title') }}</h1>
        <p>{{ t('expeditionGroups.description') }}</p>
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
            class="route-state"
            :class="{ ready: isRouteEnabled }"
        >
          <i
              class="pi"
              :class="isRouteEnabled ? 'pi-check-circle' : 'pi-info-circle'"
          />

          {{
            isRouteEnabled
                ? t('checkpoints.routeEnabled')
                : t('expeditionGroups.routeNotEnabled')
          }}
        </span>
      </article>

      <div v-if="isRouteEnabled" class="expedition-group-content">
        <form class="expedition-group-form-card" @submit.prevent="submitForm">
          <div class="section-heading">
            <span class="section-icon">
              <i class="pi pi-users" />
            </span>

            <div>
              <h2>{{ t('expeditionGroups.addGroup') }}</h2>
              <p>{{ t('expeditionGroups.description') }}</p>
            </div>
          </div>

          <div class="form-field">
            <label for="group-name">
              {{ t('expeditionGroups.name') }}
            </label>

            <pv-input-text
                id="group-name"
                v-model="form.name"
                :placeholder="t('expeditionGroups.namePlaceholder')"
                :invalid="Boolean(fieldErrors.name)"
                fluid
            />

            <small v-if="fieldErrors.name" class="field-error">
              {{ t(fieldErrors.name) }}
            </small>
          </div>

          <div class="form-field">
            <label for="group-departure-date">
              {{ t('expeditionGroups.departureDate') }}
            </label>

            <pv-input-text
                id="group-departure-date"
                v-model="form.departureDate"
                type="date"
                :invalid="Boolean(fieldErrors.departureDate)"
                fluid
            />

            <small v-if="fieldErrors.departureDate" class="field-error">
              {{ t(fieldErrors.departureDate) }}
            </small>
          </div>

          <div class="form-field">
            <label for="group-maximum-capacity">
              {{ t('expeditionGroups.maximumCapacity') }}
            </label>

            <pv-input-number
                id="group-maximum-capacity"
                v-model="form.maximumCapacity"
                :min="1"
                :use-grouping="false"
                :invalid="Boolean(fieldErrors.maximumCapacity)"
                fluid
            />

            <small v-if="fieldErrors.maximumCapacity" class="field-error">
              {{ t(fieldErrors.maximumCapacity) }}
            </small>
          </div>

          <p v-if="submissionErrorKey" class="request-error">
            {{ t(submissionErrorKey) }}
          </p>

          <pv-button
              type="submit"
              :label="t('expeditionGroups.addGroup')"
              icon="pi pi-plus"
          />
        </form>

        <section class="expedition-group-list-card">
          <div class="expedition-group-list-header">
            <div>
              <h2>{{ t('expeditionGroups.title') }}</h2>
              <p>
                {{
                  t('expeditionGroups.registeredCount', {
                    count: expeditionGroups.length,
                  })
                }}
              </p>
            </div>

            <i class="pi pi-users list-icon" />
          </div>

          <div v-if="expeditionGroups.length" class="expedition-group-list">
            <article
                v-for="expeditionGroup in expeditionGroups"
                :key="expeditionGroup.id"
                class="expedition-group-item"
            >
              <div class="expedition-group-item-row">
                <div>
                  <strong>{{ expeditionGroup.name }}</strong>
                  <p>
                    {{ expeditionGroup.departureDate }}
                    ·
                    {{ expeditionGroup.maximumCapacity }}
                  </p>
                </div>

                <div class="field-guide-status">
                  <span v-if="expeditionGroup.fieldGuideId" class="field-guide-assigned">
                    <i class="pi pi-user" />
                    {{ getFieldGuideName(expeditionGroup.fieldGuideId) }}
                  </span>

                  <span v-else class="field-guide-missing">
                    <i class="pi pi-exclamation-circle" />
                    {{ t('expeditionGroups.noFieldGuideAssigned') }}
                  </span>

                  <pv-button
                      :label="t('expeditionGroups.assignFieldGuide')"
                      size="small"
                      outlined
                      @click="openGuideAssignment(expeditionGroup)"
                  />

                </div>
              </div>

              <div
                  v-if="guideAssignmentGroupId === expeditionGroup.id"
                  class="guide-assignment-panel"
              >
                <div class="form-field">
                  <label :for="`field-guide-${expeditionGroup.id}`">
                    {{ t('expeditionGroups.fieldGuide') }}
                  </label>

                  <pv-select
                      :id="`field-guide-${expeditionGroup.id}`"
                      v-model="guideAssignmentFieldGuideId"
                      :options="store.fieldGuides"
                      option-label="name"
                      option-value="id"
                      :placeholder="t('expeditionGroups.fieldGuidePlaceholder')"
                      :invalid="Boolean(guideAssignmentFieldError)"
                      fluid
                  />

                  <small v-if="guideAssignmentFieldError" class="field-error">
                    {{ t(guideAssignmentFieldError) }}
                  </small>
                </div>

                <p v-if="guideAssignmentConflict" class="field-guide-conflict-warning">
                  {{ t('expeditionGroups.fieldGuideDateConflictWarning') }}
                </p>

                <p v-if="guideAssignmentSubmissionError" class="request-error">
                  {{ t(guideAssignmentSubmissionError) }}
                </p>

                <div class="guide-assignment-actions">
                  <pv-button
                      type="button"
                      :label="t('common.cancel')"
                      severity="secondary"
                      outlined
                      @click="closeGuideAssignment"
                  />

                  <pv-button
                      v-if="guideAssignmentConflict"
                      type="button"
                      :label="t('expeditionGroups.confirmAssignAnyway')"
                      severity="warn"
                      @click="submitGuideAssignment(true)"
                  />

                  <pv-button
                      v-else
                      type="button"
                      :label="t('expeditionGroups.assignFieldGuide')"
                      icon="pi pi-save"
                      @click="submitGuideAssignment(false)"
                  />
                </div>
              </div>
            </article>
          </div>

          <div v-else class="empty-state">
            <i class="pi pi-users" />
            <h3>{{ t('expeditionGroups.noGroups') }}</h3>
            <p>{{ t('expeditionGroups.noGroupsDescription') }}</p>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.expedition-group-configuration-view {
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
.expedition-group-list-header p,
.expedition-group-item p,
.empty-state p {
  color: var(--vt-muted);
}

.loading-message {
  color: var(--vt-muted);
}

.route-context-card,
.expedition-group-form-card,
.expedition-group-list-card {
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

.expedition-group-content {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 1.5rem;
}

.expedition-group-form-card,
.expedition-group-list-card {
  padding: 1.5rem;
}

.section-heading {
  display: flex;
  gap: 0.85rem;
  margin-bottom: 1.6rem;
}

.section-heading h2,
.expedition-group-list-header h2 {
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

.expedition-group-list-header {
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

.expedition-group-list {
  display: grid;
}

.expedition-group-item {
  display: grid;
  gap: 0.9rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--vt-border);
}

.expedition-group-item:last-child {
  border-bottom: 0;
}

.expedition-group-item strong {
  color: var(--vt-text);
}

.expedition-group-item p {
  margin: 0.25rem 0 0;
  font-size: 0.82rem;
}

.expedition-group-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.9rem;
}

.field-guide-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.82rem;
  font-weight: 700;
}

.field-guide-assigned {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: #157347;
}

.field-guide-missing {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: #9b5b00;
}

.guide-assignment-panel {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--vt-border);
  border-radius: 0.75rem;
  background: var(--vt-surface-soft);
}

.field-guide-conflict-warning {
  color: #9b5b00;
  font-size: 0.82rem;
  font-weight: 700;
}

.guide-assignment-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
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
  .expedition-group-configuration-view {
    padding: 2rem 1.25rem;
  }

  .view-header,
  .route-context-card {
    align-items: stretch;
    flex-direction: column;
  }

  .expedition-group-content {
    grid-template-columns: 1fr;
  }

  .route-state {
    max-width: none;
  }
}
</style>
