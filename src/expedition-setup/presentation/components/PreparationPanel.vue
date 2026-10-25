<script setup>
import { inject, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorkflow } from '../../../shared/application/use-workflow.js';
import WorkflowFeedback from '../../../shared/presentation/components/WorkflowFeedback.vue';
const { prep, iam, group, members, notes, protocol, segments, routeEntity, execution, refresh } = inject('expedition-workspace');
const { t } = useI18n(), { busy, error, message, execute } = useWorkflow();
const devices = reactive({}), content = reactive({ note: notes.value.map((n) => n.content).join('\n'), instructions: protocol.value?.instructions ?? '' });
async function assign(member) { await execute(async () => { await prep.saveParticipant(group.value, member, { wearableId: devices[member.id] }, members.value); await refresh(); }); }
async function start() { await execute(async () => { await execution.start(group.value, members.value, prep.preparations, routeEntity.value, protocol.value, segments.value); await refresh(); }); }
</script>
<template>
  <div class="vt-stack"><WorkflowFeedback :busy="busy" :error="error" :message="message" />
    <section class="vt-panel"><div class="vt-page-header"><div><h2>{{ t('workflow.preparation') }}</h2><p>{{ t('workflow.preparationDescription') }}</p></div><RouterLink v-if="group.status === 'scheduled'" :to="`${iam.isAdmin ? '/operations' : '/field-guide'}/groups/${group.id}/manifest`" class="vt-button secondary">{{ t('workflow.manifest') }}</RouterLink></div>
      <div class="vt-table-wrap"><table class="vt-table"><thead><tr><th>{{ t('auth.name') }}</th><th>{{ t('workflow.wearable') }}</th><th>{{ t('workflow.consent') }}</th><th>{{ t('workflow.activation') }}</th><th>{{ t('workflow.actions') }}</th></tr></thead><tbody><tr v-for="member in members" :key="member.id"><td>{{ member.fullName }}</td><td>{{ prep.wearables.find((w) => w.id === prep.forMember(member.id)?.wearableId)?.code ?? '—' }}</td><td>{{ t(prep.forMember(member.id)?.consent ? 'workflow.accepted' : 'workflow.pending') }}</td><td>{{ t(prep.forMember(member.id)?.activated ? 'workflow.ready' : 'workflow.pending') }}</td><td><form v-if="group.status === 'scheduled'" class="vt-actions" @submit.prevent="assign(member)"><select v-model="devices[member.id]" required :aria-label="`${t('workflow.wearable')} — ${member.fullName}`"><option :value="undefined" disabled>{{ t('workflow.select') }}</option><option v-for="device in prep.wearables.filter((w) => w.status === 'available' || w.id === prep.forMember(member.id)?.wearableId)" :key="device.id" :value="device.id">{{ device.code }}</option></select><button class="vt-button secondary" :disabled="busy">{{ t('workflow.assign') }}</button></form><span v-else>—</span></td></tr></tbody></table></div>
      <p v-if="!members.length">{{ t('workflow.empty') }}</p>
      <button v-if="!iam.isAdmin && group.status === 'scheduled'" class="vt-button" :disabled="busy" @click="start">{{ t('workflow.start') }}</button>
    </section>
    <section class="vt-panel"><h2>{{ t('workflow.routeContent') }}</h2>
      <form v-if="iam.isAdmin" class="vt-form" @submit.prevent="execute(async () => { await prep.saveRouteContent(group.routeId, content.note, content.instructions); await refresh(); })"><label>{{ t('workflow.notes') }}<textarea v-model="content.note" required rows="4" maxlength="5000" /></label><label>{{ t('workflow.protocol') }}<textarea v-model="content.instructions" required rows="4" maxlength="5000" /></label><button class="vt-button" :disabled="busy">{{ t('workflow.save') }}</button></form>
      <template v-else><h3>{{ t('workflow.notes') }}</h3><p v-for="note in notes" :key="note.id" class="vt-preserve">{{ note.content }}</p><h3>{{ t('workflow.protocol') }}</h3><p class="vt-preserve">{{ protocol?.instructions ?? t('workflow.empty') }}</p></template>
    </section>
  </div>
</template>
