<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ManifestEntry } from '../../domain/model/manifest-entry.entity.js';
import useExpeditionSetupStore from '../../application/expedition-setup.store.js';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const store = useExpeditionSetupStore();

const expeditionGroupId = Number(route.params.groupId);

const form = reactive({
  fullName: '',
  identityDocument: '',
});

const fieldErrors = reactive({
  fullName: '',
  identityDocument: '',
});

const submissionErrorKey = ref('');

const expeditionGroup = computed(() => (
    store.expeditionGroups.find((group) => group.id === expeditionGroupId)
));

const manifestEntries = computed(() => (
    store.getManifestEntriesByGroupId(expeditionGroupId)
));

const isAtMaximumCapacity = computed(() => (
    store.isGroupAtMaximumCapacity(expeditionGroupId)
));

const isLoading = computed(() => (
    !store.expeditionGroupsLoaded || !store.manifestEntriesLoaded
));
const isFieldGuideWorkspace = computed(() => (
    route.meta.workspace === 'field-guide'
));

function validateForm() {
  fieldErrors.fullName = '';
  fieldErrors.identityDocument = '';

  if (!form.fullName.trim()) {
    fieldErrors.fullName = 'validation.manifestFullNameRequired';
  }

  if (!form.identityDocument.trim()) {
    fieldErrors.identityDocument = 'validation.manifestIdentityDocumentRequired';
  }

  return !fieldErrors.fullName && !fieldErrors.identityDocument;
}

function resetForm() {
  form.fullName = '';
  form.identityDocument = '';
}

function submitForm() {
  submissionErrorKey.value = '';
  store.clearErrors();

  if (!validateForm()) {
    return;
  }

  const manifestEntry = new ManifestEntry({
    expeditionGroupId,
    fullName: form.fullName.trim(),
    identityDocument: form.identityDocument.trim(),
  });

  store.addManifestEntry(manifestEntry)
      .then((newManifestEntry) => {
        if (newManifestEntry) {
          resetForm();
          return;
        }

        submissionErrorKey.value = store.errors.at(-1)?.code
            ?? 'errors.manifestEntryCreationFailed';
      });
}

function goBackToGroups() {
  if (isFieldGuideWorkspace.value) {
    router.push({ name: 'field-guide-workspace' });
    return;
  }

  router.push({
    name: 'route-groups',
    params: { routeId: Number(route.params.routeId) },
  });
}

onMounted(() => {
  Promise.all([
    store.fetchExpeditionGroups(),
    store.fetchManifestEntries(),
  ]).then(() => {
    if (!expeditionGroup.value) {
      goBackToGroups();
    }
  });
});
</script>

<template>
  <section v-if="expeditionGroup" class="manifest-view">
    <header class="view-header">
      <div>
        <p class="eyebrow">
          {{ t('manifest.title') }} / {{ expeditionGroup.name }}
        </p>

        <h1>{{ t('manifest.title') }}</h1>
        <p>{{ t('manifest.description') }}</p>
      </div>

      <pv-button
          :label="t('common.backToGroups')"
          icon="pi pi-arrow-left"
          severity="secondary"
          outlined
          @click="goBackToGroups"
      />
    </header>

    <p v-if="isLoading" class="loading-message">
      {{ t('common.loading') }}
    </p>

    <template v-else>
      <article class="group-context-card">
        <div>
          <span class="group-context-label">
            {{ expeditionGroup.name }}
          </span>

          <h2>{{ expeditionGroup.departureDate }}</h2>
        </div>

        <span
            class="capacity-summary"
            :class="{ full: isAtMaximumCapacity }"
        >
          <i class="pi pi-users" />

          {{
            t('manifest.registeredCount', {
              count: manifestEntries.length,
              capacity: expeditionGroup.maximumCapacity,
            })
          }}
        </span>
      </article>

      <div class="manifest-content">
        <form
            v-if="!isAtMaximumCapacity"
            class="manifest-form-card"
            @submit.prevent="submitForm"
        >
          <div class="section-heading">
            <span class="section-icon">
              <i class="pi pi-user-plus" />
            </span>

            <div>
              <h2>{{ t('manifest.addEntry') }}</h2>
              <p>{{ t('manifest.description') }}</p>
            </div>
          </div>

          <div class="form-field">
            <label for="manifest-full-name">
              {{ t('manifest.fullName') }}
            </label>

            <pv-input-text
                id="manifest-full-name"
                v-model="form.fullName"
                :placeholder="t('manifest.fullNamePlaceholder')"
                :invalid="Boolean(fieldErrors.fullName)"
                fluid
            />

            <small v-if="fieldErrors.fullName" class="field-error">
              {{ t(fieldErrors.fullName) }}
            </small>
          </div>

          <div class="form-field">
            <label for="manifest-identity-document">
              {{ t('manifest.identityDocument') }}
            </label>

            <pv-input-text
                id="manifest-identity-document"
                v-model="form.identityDocument"
                :placeholder="t('manifest.identityDocumentPlaceholder')"
                :invalid="Boolean(fieldErrors.identityDocument)"
                fluid
            />

            <small v-if="fieldErrors.identityDocument" class="field-error">
              {{ t(fieldErrors.identityDocument) }}
            </small>
          </div>

          <p v-if="submissionErrorKey" class="request-error">
            {{ t(submissionErrorKey) }}
          </p>

          <pv-button
              type="submit"
              :label="t('manifest.addEntry')"
              icon="pi pi-plus"
          />
        </form>

        <p v-else class="capacity-reached-message">
          {{ t('manifest.capacityReached') }}
        </p>

        <section class="manifest-list-card">
          <div class="manifest-list-header">
            <div>
              <h2>{{ t('manifest.title') }}</h2>
              <p>
                {{
                  t('manifest.registeredCount', {
                    count: manifestEntries.length,
                    capacity: expeditionGroup.maximumCapacity,
                  })
                }}
              </p>
            </div>

            <i class="pi pi-id-card list-icon" />
          </div>

          <div v-if="manifestEntries.length" class="manifest-list">
            <article
                v-for="manifestEntry in manifestEntries"
                :key="manifestEntry.id"
                class="manifest-item"
            >
              <div>
                <strong>{{ manifestEntry.fullName }}</strong>
                <p>{{ manifestEntry.identityDocument }}</p>
              </div>
            </article>
          </div>

          <div v-else class="empty-state">
            <i class="pi pi-id-card" />
            <h3>{{ t('manifest.noEntries') }}</h3>
            <p>{{ t('manifest.noEntriesDescription') }}</p>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.manifest-view {
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
.group-context-label {
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
.group-context-card p,
.section-heading p,
.manifest-list-header p,
.manifest-item p,
.empty-state p {
  color: var(--vt-muted);
}

.loading-message {
  color: var(--vt-muted);
}

.group-context-card,
.manifest-form-card,
.manifest-list-card {
  border: 1px solid var(--vt-border);
  border-radius: 1.1rem;
  background: #ffffff;
  box-shadow: 0 0.75rem 1.8rem rgb(15 41 55 / 6%);
}

.group-context-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  padding: 1.5rem;
}

.group-context-card h2 {
  margin-bottom: 0.45rem;
  font-size: 1.3rem;
}

.capacity-summary {
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

.capacity-summary.full {
  background: #e6f8ef;
  color: #157347;
}

.manifest-content {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 1.5rem;
}

.manifest-form-card,
.manifest-list-card {
  padding: 1.5rem;
}

.capacity-reached-message {
  padding: 1.5rem;
  border: 1px dashed var(--vt-border);
  border-radius: 1.1rem;
  color: var(--vt-muted);
}

.section-heading {
  display: flex;
  gap: 0.85rem;
  margin-bottom: 1.6rem;
}

.section-heading h2,
.manifest-list-header h2 {
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

.manifest-list-header {
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

.manifest-list {
  display: grid;
}

.manifest-item {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--vt-border);
}

.manifest-item:last-child {
  border-bottom: 0;
}

.manifest-item strong {
  color: var(--vt-text);
}

.manifest-item p {
  margin: 0.25rem 0 0;
  font-size: 0.82rem;
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
  .manifest-view {
    padding: 2rem 1.25rem;
  }

  .view-header,
  .group-context-card {
    align-items: stretch;
    flex-direction: column;
  }

  .manifest-content {
    grid-template-columns: 1fr;
  }

  .capacity-summary {
    max-width: none;
  }
}
</style>
