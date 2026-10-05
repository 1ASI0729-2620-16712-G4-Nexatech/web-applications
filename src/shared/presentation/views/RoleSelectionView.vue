<script setup>
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import logoUrl from '../../../assets/vitaltrek-logo.png';

const router = useRouter();
const { t } = useI18n();

function selectWorkspace(path) {
  router.push(path);
}
</script>

<template>
  <main class="role-selection">
    <section class="role-selection-card">
      <header class="role-selection-header">
        <img
            :src="logoUrl"
            :alt="t('app.name')"
            class="brand-logo"
        >

        <p>{{ t('roleSelection.eyebrow') }}</p>
        <h1>{{ t('roleSelection.title') }}</h1>
        <span>{{ t('roleSelection.description') }}</span>
      </header>

      <div class="workspace-options">
        <article class="workspace-option">
          <span class="workspace-icon">
            <i class="pi pi-briefcase" />
          </span>

          <div>
            <h2>{{ t('roleSelection.operationsTitle') }}</h2>
            <p>{{ t('roleSelection.operationsDescription') }}</p>
          </div>

          <pv-button
              :label="t('roleSelection.operationsAction')"
              icon="pi pi-arrow-right"
              icon-pos="right"
              @click="selectWorkspace('/operations/routes')"
          />
        </article>

        <article class="workspace-option">
          <span class="workspace-icon field-guide-icon">
            <i class="pi pi-compass" />
          </span>

          <div>
            <h2>{{ t('roleSelection.fieldGuideTitle') }}</h2>
            <p>{{ t('roleSelection.fieldGuideDescription') }}</p>
          </div>

          <pv-button
              :label="t('roleSelection.fieldGuideAction')"
              icon="pi pi-arrow-right"
              icon-pos="right"
              @click="selectWorkspace('/field-guide/groups')"
          />
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.role-selection {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 2rem;
  background:
      radial-gradient(circle at top right, rgb(33 135 138 / 18%), transparent 32rem),
      var(--vt-background);
}

.role-selection-card {
  width: min(100%, 64rem);
  padding: clamp(1.5rem, 5vw, 4rem);
  border: 1px solid var(--vt-border);
  border-radius: 1.5rem;
  background: #ffffff;
  box-shadow: 0 1.5rem 3.5rem rgb(15 41 55 / 10%);
}

.role-selection-header {
  max-width: 42rem;
  margin-bottom: 2.5rem;
  text-align: center;
}

.brand-logo {
  width: 4rem;
  height: 4rem;
  margin-bottom: 1.25rem;
  object-fit: contain;
}

.role-selection-header p {
  margin: 0 0 0.5rem;
  color: var(--vt-teal);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.role-selection-header h1 {
  margin: 0 0 0.75rem;
  color: var(--vt-text);
  font-size: clamp(2rem, 5vw, 3.25rem);
}

.role-selection-header span {
  color: var(--vt-muted);
}

.workspace-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
}

.workspace-option {
  display: grid;
  gap: 1.25rem;
  padding: 1.5rem;
  border: 1px solid var(--vt-border);
  border-radius: 1rem;
  background: var(--vt-surface-soft);
}

.workspace-icon {
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  border-radius: 0.75rem;
  background: var(--vt-primary);
  color: #ffffff;
  font-size: 1.25rem;
}

.field-guide-icon {
  background: var(--vt-teal);
}

.workspace-option h2 {
  margin: 0 0 0.5rem;
  color: var(--vt-text);
  font-size: 1.25rem;
}

.workspace-option p {
  min-height: 3rem;
  margin: 0;
  color: var(--vt-muted);
  line-height: 1.55;
}

@media (max-width: 700px) {
  .role-selection {
    padding: 1rem;
  }

  .workspace-options {
    grid-template-columns: 1fr;
  }
}
</style>