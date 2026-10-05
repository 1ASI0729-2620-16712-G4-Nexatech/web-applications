<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import logoUrl from '../../../assets/vitaltrek-logo.png';
import LanguageSwitcher from './LanguageSwitcher.vue';

const props = defineProps({
  workspace: {
    type: String,
    required: true,
  },
});

const { t } = useI18n();

const isFieldGuide = computed(() => (
    props.workspace === 'field-guide'
));

const navigationTitle = computed(() => (
    isFieldGuide.value
        ? t('layout.fieldGuideNavigation')
        : t('layout.navigation')
));

const workspaceEnvironment = computed(() => (
    isFieldGuide.value
        ? t('layout.fieldGuideEnvironment')
        : t('layout.routeSetupEnvironment')
));

const workspaceCommandBase = computed(() => (
    isFieldGuide.value
        ? t('layout.fieldGuideCommandBase')
        : t('layout.commandBase')
));

const navigationItems = computed(() => {
  if (isFieldGuide.value) {
    return [
      {
        label: t('layout.assignedGroups'),
        icon: 'pi pi-users',
        to: '/field-guide/groups',
      },
    ];
  }

  return [
    {
      label: t('common.dashboard'),
      icon: 'pi pi-home',
      to: '/operations',
    },
    {
      label: t('layout.routesAndCheckpoints'),
      icon: 'pi pi-map',
      to: '/operations/routes',
    },
    {
      label: t('common.progress'),
      icon: 'pi pi-chart-line',
      to: '/operations/progress',
    },
    {
      label: t('common.alerts'),
      icon: 'pi pi-bell',
      to: '/operations/alerts',
    },
  ];
});
</script>

<template>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-logo-container">
          <img :src="logoUrl" :alt="t('app.name')" class="brand-logo">
        </div>
      </div>

      <div class="sidebar-divider" />

      <p class="navigation-title">{{ navigationTitle }}</p>

      <nav class="navigation" :aria-label="navigationTitle">
        <RouterLink
            v-for="item in navigationItems"
            :key="item.to"
            :to="item.to"
            class="navigation-link"
            active-class="navigation-link-active"
        >
          <i :class="item.icon" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-bottom">
        <RouterLink to="/" class="workspace-switcher">
          <i class="pi pi-arrow-left" />
          <span>{{ t('layout.changeWorkspace') }}</span>
        </RouterLink>

        <div class="connection-status">
          <span class="status-dot" />

          <div>
            <strong>{{ t('app.name') }}</strong>
            <small>{{ workspaceEnvironment }}</small>
          </div>
        </div>
      </div>
    </aside>

    <section class="content">
      <header class="topbar">
        <div class="topbar-location">
          <i class="pi pi-compass" aria-hidden="true" />
          <span>{{ t('layout.sector') }}</span>
        </div>

        <div class="topbar-actions">
          <span class="topbar-section">{{ workspaceCommandBase }}</span>
          <LanguageSwitcher />
        </div>
      </header>

      <main class="page-content">
        <slot />
      </main>
    </section>
  </div>
</template>

<style scoped>
.app-layout {
  display: grid;
  grid-template-columns: 19.125rem minmax(0, 1fr);
  min-height: 100vh;
  background: var(--vt-background);
}

.sidebar {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--vt-primary);
  color: #ffffff;
}

.brand {
  display: flex;
  align-items: center;
  padding: 1.5rem;
}

.brand-logo-container {
  display: grid;
  width: 100%;
  aspect-ratio: 1024 / 347;
  place-items: center;
  border-radius: 0.75rem;
  background: #ffffff;
  padding: 0.5rem;
}

.brand-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.sidebar-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.13);
}

.navigation-title {
  margin: 1.75rem 1.25rem 0.75rem;
  color: #aac7b9;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.navigation {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0 1.25rem;
}

.navigation-link {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-height: 4.5rem;
  padding: 0.875rem 1rem;
  border-radius: 0.75rem;
  color: #d7e8df;
  font-size: 1rem;
  font-weight: 700;
  text-decoration: none;
}

.navigation-link:hover {
  background: rgba(255, 255, 255, 0.08);
}

.navigation-link-active {
  background: #21878a;
  color: #ffffff;
}

.navigation-link i {
  font-size: 1.25rem;
}
.workspace-switcher {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-bottom: 0.75rem;
  padding: 0.75rem 0.875rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 0.625rem;
  color: #d7e8df;
  font-size: 0.8rem;
  font-weight: 700;
  text-decoration: none;
}

.workspace-switcher:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.sidebar-bottom {
  margin-top: auto;
  padding: 1.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.13);
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem;
  border-radius: 0.625rem;
  background: rgba(0, 0, 0, 0.2);
}

.status-dot {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 9999px;
  background: #35c58b;
}

.connection-status strong,
.connection-status small {
  display: block;
}

.connection-status strong {
  font-size: 0.8rem;
}

.connection-status small {
  margin-top: 0.15rem;
  color: #b8d0c4;
  font-size: 0.72rem;
}

.content {
  min-width: 0;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 3.25rem;
  padding: 0.4rem 2.5rem;
  background: var(--vt-primary);
  border-left: 1px solid rgba(255, 255, 255, 0.15);
  color: #eaf5ef;
}

.topbar-location,
.topbar-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.topbar-location {
  font-size: 0.875rem;
  font-weight: 700;
}

.topbar-location i {
  color: #62c9cb;
}

.topbar-section {
  color: #c3d9ce;
  font-size: 0.8rem;
  font-weight: 600;
}

.page-content {
  width: min(100%, 90rem);
  margin: 0 auto;
  padding: 2.5rem;
}

@media (max-width: 900px) {
  .app-layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
    height: auto;
  }

  .brand {
    min-height: auto;
    padding: 1rem;
  }

  .navigation-title,
  .sidebar-bottom {
    display: none;
  }

  .navigation {
    flex-direction: row;
    padding: 0 1rem 1rem;
  }

  .navigation-link {
    flex: 1;
    justify-content: center;
    min-height: 3.25rem;
  }

  .topbar {
    padding: 0.5rem 1rem;
  }

  .page-content {
    padding: 1rem;
  }
}

@media (max-width: 560px) {
  .topbar-section {
    display: none;
  }

  .topbar-location span {
    font-size: 0.75rem;
  }

  .navigation-link span {
    font-size: 0.85rem;
  }
}
</style>