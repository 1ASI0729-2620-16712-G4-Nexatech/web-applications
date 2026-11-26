<script setup>
import { useI18n } from 'vue-i18n';
import { useTrackingTime } from '../use-tracking-time.js';

defineProps({
    readings: { type: Array, required: true },
    members: { type: Array, required: true },
});
const { t } = useI18n();
const { timestamp, age } = useTrackingTime();
</script>

<template>
  <div class="vt-stack">
    <p v-if="!readings.length" class="vt-muted">{{ t('groupProgress.noReadings') }}</p>
    <div v-else class="vt-table-wrap">
      <table class="vt-table">
        <thead>
          <tr>
            <th>{{ t('workflow.participant') }}</th>
            <th>{{ t('groupProgress.capturedAt') }}</th>
            <th>{{ t('groupProgress.synchronizedAt') }}</th>
            <th>{{ t('workflow.heartRate') }}</th>
            <th>{{ t('workflow.battery') }}</th>
            <th>{{ t('groupProgress.position') }}</th>
            <th>{{ t('workflow.deviation') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="reading in readings" :key="reading.memberId">
            <td>{{ members.find((member) => member.id === reading.memberId)?.fullName ?? reading.memberId }}</td>
            <td><time :datetime="reading.recordedAt">{{ timestamp(reading.recordedAt) }}</time><br>{{ age(reading.recordedAt) }}</td>
            <td><time :datetime="reading.synchronizedAt">{{ timestamp(reading.synchronizedAt) }}</time></td>
            <td>{{ reading.heartRate ?? '—' }}</td>
            <td>{{ reading.battery == null ? '—' : `${reading.battery}%` }}</td>
            <td>
              {{ reading.latitude }}, {{ reading.longitude }}
              <br>{{ t('groupProgress.altitude') }}: {{ reading.altitude }} m
            </td>
            <td>
              {{ reading.deviationMeters == null ? '—' : `${reading.deviationMeters} m` }}
              <small v-if="reading.isDeviationSimulated">({{ t('groupProgress.simulated') }})</small>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
