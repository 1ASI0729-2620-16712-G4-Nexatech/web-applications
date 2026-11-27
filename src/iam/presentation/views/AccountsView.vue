<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import useIamStore from '../../application/iam.store.js';
import { Roles } from '../../domain/user.entity.js';
import {
    forgetGuideProfile, guidesWithoutAccount, hasAccount, pendingGuideProfile, rememberGuideProfile,
} from '../../application/guide-account-onboarding.js';
import useSetupStore from '../../../expedition-setup/application/expedition-setup.store.js';
import usePreparationStore from '../../../expedition-setup/application/preparation.store.js';
import { useWorkflow } from '../../../shared/application/use-workflow.js';
import WorkflowFeedback from '../../../shared/presentation/components/WorkflowFeedback.vue';

const iam = useIamStore(), setup = useSetupStore(), prep = usePreparationStore(), { t } = useI18n();
const { busy, error, message, execute } = useWorkflow();
const profile = reactive({ name: '', code: '' });
const form = reactive({ name: '', username: '', password: '', role: Roles.GUIDE, fieldGuideId: null, identityDocument: '' });
/** Profile created in step 1 whose account is still missing; it survives a reload of this browser session. */
const pending = ref(pendingGuideProfile(iam.user?.id));
const accountPanel = ref(null);

const guideOptions = computed(() => setup.fieldGuides.map((guide) => ({ guide, linked: hasAccount(guide, iam.users) })));
const withoutAccount = computed(() => guidesWithoutAccount(setup.fieldGuides, iam.users));
const selectedGuide = computed(() => setup.fieldGuides.find((guide) => guide.id === form.fieldGuideId) ?? null);

onMounted(async () => {
    await execute(() => Promise.all([iam.fetchUsers(), setup.fetchFieldGuides(), setup.fetchManifestEntries()]), '');
    // The profile already has an account (for example, created from another tab): nothing is pending any more.
    if (pending.value && iam.users.some((user) => user.fieldGuideId === pending.value.id)) clearPending();
    else if (pending.value) prepareAccountFor(pending.value);
});

function clearPending() {
    forgetGuideProfile(iam.user?.id);
    pending.value = null;
}

/** Step 2 starts with the profile already selected, so the account is linked to that fieldGuideId. */
function prepareAccountFor(guide) {
    Object.assign(form, { role: Roles.GUIDE, fieldGuideId: guide.id, name: form.name || guide.name });
    accountPanel.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

async function addGuide() {
    const created = await execute(async () => {
        const guide = await prep.createGuide(profile.name, profile.code);
        await setup.fetchFieldGuides();
        return guide;
    }, 'guideAccounts.profileSaved');
    if (!created) return;
    rememberGuideProfile(iam.user?.id, created);
    pending.value = { id: created.id, name: created.name, code: created.code };
    Object.assign(profile, { name: '', code: '' });
    prepareAccountFor(created);
}

async function save() {
    const linkedGuideId = form.role === Roles.GUIDE ? form.fieldGuideId : null;
    const result = await execute(() => iam.createAccount({
        ...form, fieldGuideId: linkedGuideId, identityDocument: form.role === Roles.TOURIST ? form.identityDocument : null,
    }), 'guideAccounts.accountCreated');
    if (!result) return;
    if (linkedGuideId && pending.value?.id === linkedGuideId) clearPending();
    Object.assign(form, { name: '', username: '', password: '', fieldGuideId: null, identityDocument: '' });
}
</script>

<template>
  <div class="vt-page"><header><p class="vt-eyebrow">IAM</p><h1>{{ t('auth.accounts') }}</h1><p>{{ t('auth.accountsDescription') }}</p></header>
    <WorkflowFeedback :busy="busy" :error="error" :message="message" />
    <div class="vt-grid">
      <section class="vt-panel">
        <h2>{{ t('guideAccounts.step1') }}</h2>
        <p class="vt-muted">{{ t('guideAccounts.step1Description') }}</p>
        <form class="vt-form" @submit.prevent="addGuide">
          <label>{{ t('auth.name') }}<input v-model="profile.name" required maxlength="120"></label>
          <label>{{ t('guideAccounts.code') }}<input v-model="profile.code" maxlength="20" pattern="[A-Za-z0-9][A-Za-z0-9\-]{1,19}" :placeholder="t('guideAccounts.codePlaceholder')"></label>
          <small>{{ t('guideAccounts.codeHint') }}</small>
          <button class="vt-button secondary" :disabled="busy">{{ t('guideAccounts.saveProfile') }}</button>
        </form>

        <h3>{{ t('guideAccounts.withoutAccount') }}</h3>
        <ul class="vt-list">
          <li v-for="guide in withoutAccount" :key="guide.id">
            <strong>{{ guide.label }}</strong>
            <button type="button" class="vt-button secondary" :disabled="busy" @click="prepareAccountFor(guide)">{{ t('guideAccounts.createAccountFor') }}</button>
          </li>
        </ul>
        <p v-if="!withoutAccount.length">{{ t('workflow.empty') }}</p>
      </section>

      <section ref="accountPanel" class="vt-panel">
        <h2>{{ t('guideAccounts.step2') }}</h2>
        <p v-if="pending" class="vt-notice" role="status">{{ t('guideAccounts.pendingProfile', { name: pending.name, code: pending.code }) }}</p>
        <form class="vt-form" @submit.prevent="save">
          <label>{{ t('auth.role') }}<select v-model="form.role"><option :value="Roles.GUIDE">{{ t('auth.guide') }}</option><option :value="Roles.TOURIST">{{ t('auth.tourist') }}</option></select></label>
          <label v-if="form.role === Roles.GUIDE">{{ t('auth.linkedGuide') }}
            <select v-model="form.fieldGuideId" required>
              <option :value="null" disabled>{{ t('workflow.select') }}</option>
              <option v-for="option in guideOptions" :key="option.guide.id" :value="option.guide.id" :disabled="option.linked">
                {{ option.guide.label }}{{ option.linked ? ` — ${t('guideAccounts.linked')}` : '' }}
              </option>
            </select>
          </label>
          <small v-if="form.role === Roles.GUIDE && selectedGuide">{{ t('guideAccounts.linkingTo', { label: selectedGuide.label }) }}</small>
          <label v-else-if="form.role === Roles.TOURIST">{{ t('auth.document') }}<input v-model="form.identityDocument" required list="manifest-documents"><datalist id="manifest-documents"><option v-for="member in setup.manifestEntries" :key="member.id" :value="member.identityDocument">{{ member.fullName }}</option></datalist><small>{{ t('auth.documentHint') }}</small></label>
          <label>{{ t('auth.name') }}<input v-model="form.name" required maxlength="100"></label>
          <label>{{ t('auth.username') }}<input v-model="form.username" type="email" required maxlength="120" autocomplete="off"></label>
          <label>{{ t('auth.password') }}<input v-model="form.password" type="password" required minlength="6" autocomplete="new-password"></label>
          <button class="vt-button" :disabled="busy">{{ t(pending && form.fieldGuideId === pending.id ? 'guideAccounts.retryAccount' : 'auth.createAccount') }}</button>
        </form>
      </section>

      <section class="vt-panel"><h2>{{ t('auth.registeredAccounts') }}</h2>
        <ul class="vt-list">
          <li v-for="user in iam.users" :key="user.id">
            <strong>{{ user.name }}</strong><span>{{ user.username }}</span>
            <small>{{ t(`roles.${user.role}`) }}<template v-if="user.fieldGuideId"> · {{ setup.fieldGuides.find((guide) => guide.id === user.fieldGuideId)?.code ?? `#${user.fieldGuideId}` }}</template></small>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
