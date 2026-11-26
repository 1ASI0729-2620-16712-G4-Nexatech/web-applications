<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTrackingTime } from '../use-tracking-time.js';

const props = defineProps({ entry: Object, loading: Boolean });
const { t } = useI18n();
const { timestamp, age, isStale } = useTrackingTime();
const progress = computed(() => props.entry?.progress);
</script>

<template>
  <div class="vt-stack">
    <p v-if="entry?.state === 'offline'" class="vt-notice" role="status">{{ t('groupProgress.cachedProgress') }}</p>
    <template v-if="progress">
      <p v-if="progress.status === 'active' && isStale(progress.synchronizedAt)" class="vt-notice">
        {{ t('groupProgress.staleWarning') }}
      </p>
      <dl class="tracking-details">
        <div>
          <dt>{{ t('groupProgress.estimatedProgress') }}</dt>
          <dd>{{ progress.totalCheckpoints > 0 ? `${progress.estimatedProgressPercentage}%` : '—' }}</dd>
        </div>
        <div>
          <dt>{{ t('groupProgress.confirmedCheckpoints') }}</dt>
          <dd>{{ progress.confirmedCheckpointsCount }} / {{ progress.totalCheckpoints }}</dd>
        </div>
        <div>
          <dt>{{ t('groupProgress.lastConfirmedCheckpoint') }}</dt>
          <dd>
            {{ progress.lastConfirmedCheckpoint?.location ?? '—' }}
            <small v-if="progress.lastConfirmedCheckpoint?.passedAt">
              · <time :datetime="progress.lastConfirmedCheckpoint.passedAt">{{ timestamp(progress.lastConfirmedCheckpoint.passedAt) }}</time>
            </small>
          </dd>
        </div>
        <div>
          <dt>{{ t('groupProgress.nextCheckpoint') }}</dt>
          <dd>{{ progress.nextCheckpoint?.location ?? '—' }}</dd>
        </div>
        <div>
          <dt>{{ t('groupProgress.synchronizedAt') }}</dt>
          <dd v-if="progress.synchronizedAt">
            <time :datetime="progress.synchronizedAt">{{ timestamp(progress.synchronizedAt) }}</time>
            <small> · {{ age(progress.synchronizedAt) }}</small>
          </dd>
          <dd v-else>{{ t('groupProgress.noSynchronization') }}</dd>
        </div>
      </dl>
    </template>
    <p v-else-if="loading" class="vt-muted" role="status">{{ t('common.loading') }}</p>
    <p v-else-if="entry?.state === 'unavailable'" class="vt-notice" role="status">{{ t('groupProgress.unavailable') }}</p>
    <p v-else-if="entry?.session" class="vt-muted">{{ t('groupProgress.waitingProgress') }}</p>
    <p v-else class="vt-muted">{{ t('groupProgress.tourNotActive') }}</p>
  </div>
</template>

<style scoped>
.tracking-details {
  display: grid;
  gap: 0.65rem;
  margin: 0;
}
.tracking-details div {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.4rem 1rem;
}
dt, small { color: var(--vt-muted); }
dd { margin: 0; font-weight: 600; }
</style>
