<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import useIamStore from '../../application/iam.store.js';
import { SignInCommand } from '../../domain/sign-in.command.js';
import { SignUpCommand } from '../../domain/sign-up.command.js';
import { homeForRole } from '../../domain/user.entity.js';
import { useWorkflow } from '../../../shared/application/use-workflow.js';
import WorkflowFeedback from '../../../shared/presentation/components/WorkflowFeedback.vue';
import LanguageSwitcher from '../../../shared/presentation/components/LanguageSwitcher.vue';
import logo from '../../../assets/vitaltrek-logo.png';
const iam = useIamStore(), router = useRouter(), { t } = useI18n();
const { busy, error, message, execute } = useWorkflow();
const registering = ref(false);
const form = reactive({ username: '', password: '', name: '', agencyName: '' });
async function submit() {
    const result = await execute(async () => {
        if (registering.value) { await iam.signUp(new SignUpCommand(form)); registering.value = false; return; }
        await iam.signIn(new SignInCommand(form.username, form.password));
        await router.replace(homeForRole(iam.user.role));
    });
    if (result) form.password = '';
}
function demo(role) { form.username = `${role}@vitaltrek.demo`; form.password = 'VitalTrek123!'; }
</script>
<template>
  <main class="vt-auth">
    <section class="vt-auth-story">
      <img :src="logo" alt="VitalTrek" class="vt-auth-logo">
      <p class="vt-eyebrow">SAFE ADVENTURE BEYOND SIGNAL</p>
      <h1>{{ t('auth.headline') }}</h1>
      <p>{{ t('auth.intro') }}</p>
      <div class="vt-auth-features"><p><i class="pi pi-map" /> {{ t('auth.operations') }}</p><p><i class="pi pi-compass" /> {{ t('auth.tourist') }}</p></div>
    </section>
    <section class="vt-panel vt-auth-form">
      <LanguageSwitcher />
      <h2>{{ t(registering ? 'auth.register' : 'auth.signIn') }}</h2>
      <p class="vt-muted">{{ t('auth.demoNotice') }}</p>
      <WorkflowFeedback :error="error" :message="message" :busy="busy" />
      <form class="vt-form" @submit.prevent="submit">
        <label v-if="registering">{{ t('auth.agency') }}<input v-model="form.agencyName" required maxlength="100" autocomplete="organization"></label>
        <label v-if="registering">{{ t('auth.name') }}<input v-model="form.name" required maxlength="100" autocomplete="name"></label>
        <label>{{ t('auth.username') }}<input v-model="form.username" required maxlength="120" autocomplete="username"></label>
        <label>{{ t('auth.password') }}<input v-model="form.password" type="password" required :minlength="registering ? 6 : 1" :autocomplete="registering ? 'new-password' : 'current-password'"></label>
        <button class="vt-button" :disabled="busy">{{ t(registering ? 'auth.register' : 'auth.signIn') }}</button>
      </form>
      <button class="vt-link" type="button" @click="registering = !registering; error = ''; message = ''">{{ t(registering ? 'auth.back' : 'auth.createAgency') }}</button>
      <template v-if="!registering"><hr><p>{{ t('auth.tryDemo') }}</p><div class="vt-actions"><button v-for="role in ['admin', 'guide', 'tourist']" :key="role" class="vt-button secondary" @click="demo(role)">{{ t(`auth.${role}`) }}</button></div><small>{{ t('auth.demoPassword') }}: VitalTrek123!</small></template>
    </section>
  </main>
</template>
