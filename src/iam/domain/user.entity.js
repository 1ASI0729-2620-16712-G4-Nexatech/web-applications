export const Roles = Object.freeze({ ADMIN: 'operations_administrator', GUIDE: 'field_guide', TOURIST: 'adventure_tourist' });

export class User {
    constructor({ id, username, name, role, agencyId, fieldGuideId = null, identityDocument = null }) {
        Object.assign(this, { id, username, name, role, agencyId, fieldGuideId, identityDocument });
    }
}

export function homeForRole(role) {
    return role === Roles.ADMIN ? '/operations' : role === Roles.GUIDE ? '/field-guide/groups' : '/tourist/expedition';
}

export function canAccessGroup(user, group, members = []) {
    if (!user || !group || group.agencyId !== user.agencyId) return false;
    if (user.role === Roles.ADMIN) return true;
    if (user.role === Roles.GUIDE) return group.fieldGuideId === user.fieldGuideId;
    return members.some((member) => member.expeditionGroupId === group.id && member.identityDocument === user.identityDocument);
}
