<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import useIamStore from '../../application/iam.store.js';
import { Roles } from '../../domain/user.entity.js';
import useSetupStore from '../../../expedition-setup/application/expedition-setup.store.js';
import usePreparationStore from '../../../expedition-setup/application/preparation.store.js';
import { useWorkflow } from '../../../shared/application/use-workflow.js';
import WorkflowFeedback from '../../../shared/presentation/components/WorkflowFeedback.vue';
const iam = useIamStore(), setup = useSetupStore(), prep = usePreparationStore(), { t } = useI18n();
const { busy, error, message, execute } = useWorkflow();
const guideName = ref('');
const form = reactive({ name: '', username: '', password: '', role: Roles.GUIDE, fieldGuideId: null, identityDocument: '' });
onMounted(() => execute(() => Promise.all([iam.fetchUsers(), setup.fetchFieldGuides(), setup.fetchManifestEntries()]), ''));
async function save() {
    const result = await execute(() => iam.createAccount({ ...form, fieldGuideId: form.role === Roles.GUIDE ? form.fieldGuideId : null, identityDocument: form.role === Roles.TOURIST ? form.identityDocument : null }));
    if (result) Object.assign(form, { name: '', username: '', password: '' });
}
async function addGuide() { await execute(async () => { await prep.createGuide(guideName.value); await setup.fetchFieldGuides(); guideName.value = ''; }); }
</script>
<template>
  <div class="vt-page"><header><p class="vt-eyebrow">IAM</p><h1>{{ t('auth.accounts') }}</h1><p>{{ t('auth.accountsDescription') }}</p></header>
    <WorkflowFeedback :busy="busy" :error="error" :message="message" />
    <div class="vt-grid">
      <section class="vt-panel"><h2>{{ t('auth.createAccount') }}</h2>
        <form class="vt-form" @submit.prevent="save">
          <label>{{ t('auth.name') }}<input v-model="form.name" required maxlength="100"></label>
          <label>{{ t('auth.username') }}<input v-model="form.username" required maxlength="120" autocomplete="off"></label>
          <label>{{ t('auth.password') }}<input v-model="form.password" type="password" required minlength="6" autocomplete="new-password"></label>
          <label>{{ t('auth.role') }}<select v-model="form.role"><option :value="Roles.GUIDE">{{ t('auth.guide') }}</option><option :value="Roles.TOURIST">{{ t('auth.tourist') }}</option></select></label>
          <label v-if="form.role === Roles.GUIDE">{{ t('auth.linkedGuide') }}<select v-model="form.fieldGuideId" required><option :value="null" disabled>{{ t('workflow.select') }}</option><option v-for="guide in setup.fieldGuides" :key="guide.id" :value="guide.id">{{ guide.name }}</option></select></label>
          <label v-else>{{ t('auth.document') }}<input v-model="form.identityDocument" required list="manifest-documents"><datalist id="manifest-documents"><option v-for="member in setup.manifestEntries" :key="member.id" :value="member.identityDocument">{{ member.fullName }}</option></datalist><small>{{ t('auth.documentHint') }}</small></label>
          <button class="vt-button" :disabled="busy">{{ t('auth.createAccount') }}</button>
        </form>
      </section>
      <section class="vt-panel"><h2>{{ t('auth.registeredAccounts') }}</h2><ul class="vt-list"><li v-for="user in iam.users" :key="user.id"><strong>{{ user.name }}</strong><span>{{ user.username }}</span><small>{{ t(`roles.${user.role}`) }}</small></li></ul>
        <h3>{{ t('auth.addGuide') }}</h3><form class="vt-form" @submit.prevent="addGuide"><label>{{ t('auth.name') }}<input v-model="guideName" required maxlength="100"></label><button class="vt-button secondary" :disabled="busy">{{ t('workflow.save') }}</button></form>
      </section>
    </div>
  </div>
</template>
