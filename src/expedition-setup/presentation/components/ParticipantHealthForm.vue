<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import usePreparationStore from '../../application/preparation.store.js';
import { MAX_HEALTH_NOTES } from '../../domain/model/participant-preparation.entity.js';
import { useWorkflow } from '../../../shared/application/use-workflow.js';
import WorkflowFeedback from '../../../shared/presentation/components/WorkflowFeedback.vue';

/**
 * Optional health information of the signed-in tourist for one expedition. It is sent only for its own preparation and
 * is never stored in the offline snapshot of the browser.
 */
const props = defineProps({
    group: { type: Object, required: true },
    member: { type: Object, required: true },
    disabled: Boolean,
});
const prep = usePreparationStore(), { t } = useI18n();
const { busy, error, message, execute } = useWorkflow();
const preparation = computed(() => prep.forMember(props.member.id));
const notes = ref('');
watch(preparation, (current) => { notes.value = current?.healthNotes ?? ''; }, { immediate: true });

function save(value = notes.value) {
    return execute(() => prep.saveHealthInformation(props.group, props.member, value),
        value.trim() ? 'healthInformation.saved' : 'healthInformation.cleared');
}
</script>

<template>
  <form class="vt-form vt-case" @submit.prevent="save()">
    <h3>{{ t('healthInformation.title') }}</h3>
    <p class="vt-muted">{{ t('healthInformation.privacy') }}</p>
    <WorkflowFeedback :busy="busy" :error="error" :message="message" />
    <label>{{ t('healthInformation.label') }}
      <textarea v-model="notes" rows="3" :maxlength="MAX_HEALTH_NOTES" :disabled="disabled" :placeholder="t('healthInformation.placeholder')" />
    </label>
    <small>{{ t('healthInformation.remaining', { count: MAX_HEALTH_NOTES - notes.length }) }}</small>
    <p v-if="preparation?.healthNotesRecordedAt" class="vt-muted">{{ t('healthInformation.updatedAt', { date: new Date(preparation.healthNotesRecordedAt).toLocaleString() }) }}</p>
    <div class="vt-actions">
      <button class="vt-button" :disabled="busy || disabled">{{ t('workflow.save') }}</button>
      <button v-if="preparation?.healthNotes" type="button" class="vt-button secondary" :disabled="busy || disabled" @click="notes = ''; save('')">{{ t('healthInformation.clear') }}</button>
    </div>
  </form>
</template>
