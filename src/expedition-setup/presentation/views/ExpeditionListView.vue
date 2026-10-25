<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import useSetupStore from '../../application/expedition-setup.store.js';
import useIamStore from '../../../iam/application/iam.store.js';
import { canAccessGroup } from '../../../iam/domain/user.entity.js';
import { useWorkflow } from '../../../shared/application/use-workflow.js';
import WorkflowFeedback from '../../../shared/presentation/components/WorkflowFeedback.vue';
const setup = useSetupStore(), iam = useIamStore(), { t } = useI18n();
const { busy, error, execute } = useWorkflow();
const search = ref('');
const groups = computed(() => setup.expeditionGroups.filter((group) => canAccessGroup(iam.user, group) && group.name.toLowerCase().includes(search.value.toLowerCase())));
onMounted(() => execute(() => Promise.all([setup.fetchRoutes(), setup.fetchExpeditionGroups()]), ''));
const path = (group) => `${iam.isAdmin ? '/operations' : '/field-guide'}/groups/${group.id}`;
</script>
<template>
  <section class="vt-page"><header class="vt-page-header"><div><p class="vt-eyebrow">{{ t(iam.isAdmin ? 'auth.operations' : 'auth.guide') }}</p><h1>{{ t('workflow.expeditions') }}</h1><p>{{ t('workflow.expeditionsDescription') }}</p></div><RouterLink v-if="iam.isAdmin" to="/operations/routes" class="vt-button">{{ t('workflow.configureRoute') }}</RouterLink></header>
    <WorkflowFeedback :busy="busy" :error="error" />
    <label class="vt-search">{{ t('workflow.search') }}<input v-model="search" type="search"></label>
    <p v-if="!busy && !groups.length" class="vt-notice">{{ t('workflow.empty') }}</p>
    <div class="vt-grid"><article v-for="group in groups" :key="group.id" class="vt-panel"><div class="vt-page-header"><span class="vt-badge">{{ t(`workflow.status.${group.status}`) }}</span><i class="pi pi-compass vt-muted" /></div><h2>{{ group.name }}</h2><p>{{ setup.routes.find((r) => r.id === group.routeId)?.name }}</p><p class="vt-muted">{{ group.departureDate }} · {{ t('workflow.capacity') }}: {{ group.maximumCapacity }}</p><RouterLink :to="path(group)" class="vt-button secondary">{{ t('workflow.openExpedition') }} <i class="pi pi-arrow-right" /></RouterLink></article></div>
  </section>
</template>
