import { ref } from 'vue';
import { defineStore } from 'pinia';
import { CheckpointSyncApi } from '../infrastructure/checkpoint-sync-api.js';
import { SyncBatchAssembler } from '../infrastructure/sync-batch.assembler.js';
import { SyncBatch } from '../domain/model/sync-batch.entity.js';
import { createActionState } from '../../shared/application/action-state.js';
import { requireCondition } from '../../shared/domain/application-error.js';
import { queuedRecords, removeRecords } from '../../shared/infrastructure/offline-storage.js';
import useIamStore from '../../iam/application/iam.store.js';
import { Roles, canAccessGroup } from '../../iam/domain/user.entity.js';

const api = new CheckpointSyncApi();
export default defineStore('checkpointSync', () => {
    const batches = ref([]), telemetry = ref([]);
    const state = createActionState();
    async function load() {
        const [b, t] = await Promise.all([api.batches.getAll(), api.telemetry.getAll()]);
        batches.value = SyncBatchAssembler.toEntitiesFromResponse(b); telemetry.value = t.data;
    }
    async function synchronize(group, checkpoint, checkpoints, members, preparations) {
        return state.run(async () => {
            const iam = useIamStore();
            requireCondition(iam.user?.role === Roles.GUIDE && canAccessGroup(iam.user, group), 'workflow.errors.forbidden');
            const batch = new SyncBatch({ expeditionGroupId: group.id, checkpointId: checkpoint?.id, records: queuedRecords(group.agencyId, group.id) });
            batch.validate(group, checkpoint, members, preparations);
            const previous = (await api.checkIns.getAll({ expeditionGroupId: group.id })).data;
            const arrivals = [...previous, ...batch.records.filter((r) => r.kind === 'check-in')];
            requireCondition(arrivals.some((r) => r.checkpointId === checkpoint.id), 'workflow.errors.checkpointArrival');
            requireCondition(batch.records.filter((r) => r.kind === 'check-in').every((r) => checkpoints.some((c) => c.id === r.checkpointId)), 'workflow.errors.checkpoint');
            await api.batches.create(batch);
            try {
                let duplicates = 0;
                for (const record of batch.records) {
                    const endpoint = record.kind === 'telemetry' ? api.telemetry : api.checkIns;
                    const exists = (await endpoint.getAll({ id: record.id })).data.length > 0;
                    if (exists) duplicates += 1;
                    else await endpoint.create({ ...record, syncBatchId: batch.id, syncCheckpointId: checkpoint.id, synchronizedAt: batch.receivedAt });
                }
                const confirmed = (await api.checkIns.getAll({ expeditionGroupId: group.id })).data;
                const visited = checkpoints.filter((c) => confirmed.some((r) => r.checkpointId === c.id));
                const last = visited.at(-1), next = checkpoints[visited.length];
                const progress = { expeditionGroupId: group.id, lastConfirmedCheckpointLabel: last?.location ?? '—', currentSegmentLabel: next ? `${last?.location ?? '—'} → ${next.location}` : last?.location ?? '—', estimatedProgressPercentage: Math.round(visited.length / checkpoints.length * 100), recordedAt: confirmed.map((r) => r.recordedAt).sort().at(-1) ?? batch.receivedAt, synchronizedAt: batch.receivedAt, status: 'on-track', riskLevel: 'low' };
                const existing = (await api.progress.getAll({ expeditionGroupId: group.id })).data[0];
                if (existing) await api.progress.patch(existing.id, progress); else await api.progress.create(progress);
                await api.batches.patch(batch.id, { status: 'completed', duplicates, completedAt: new Date().toISOString() });
                removeRecords(group.agencyId, batch.records.map((r) => r.id));
                await load();
                return batch;
            } catch (error) {
                await api.batches.patch(batch.id, { status: 'failed', failure: 'workflow.errors.syncFailed' }).catch(() => {});
                throw error;
            }
        });
    }
    return { batches, telemetry, load, synchronize, pending: state.pending, error: state.error };
});
