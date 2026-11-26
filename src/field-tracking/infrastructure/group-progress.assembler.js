import { GroupProgress } from '../domain/model/group-progress.entity.js';

export class GroupProgressAssembler {
    static toEntityFromResource(resource, groupId) {
        if (resource?.expeditionGroupId !== groupId || !Number.isInteger(resource.sessionId)
            || resource.sessionId <= 0 || !Array.isArray(resource.confirmedCheckpoints)
            || !Array.isArray(resource.participants)) {
            throw new Error('Invalid tracking progress response');
        }
        return new GroupProgress(resource);
    }
}
