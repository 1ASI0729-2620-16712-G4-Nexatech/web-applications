import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApplicationError, requireCondition, toErrorCode } from '../src/shared/domain/application-error.js';
import { tokenExpiration } from '../src/iam/infrastructure/iam-session.js';
import { Roles, User, canAccessGroup, homeForRole } from '../src/iam/domain/user.entity.js';
import { ParticipantPreparationAssembler } from '../src/expedition-setup/infrastructure/participant-preparation.assembler.js';

test('application errors preserve workflow codes and map HTTP statuses', () => {
    assert.equal(toErrorCode({ code: 'workflow.errors.custom' }), 'workflow.errors.custom');
    assert.equal(toErrorCode({ response: { status: 400 } }), 'workflow.errors.invalid');
    assert.equal(toErrorCode({ response: { status: 401 } }), 'workflow.errors.sessionExpired');
    assert.equal(toErrorCode({ response: { status: 403 } }), 'workflow.errors.forbidden');
    assert.equal(toErrorCode({ response: { status: 404 } }), 'workflow.errors.notFound');
    assert.equal(toErrorCode({ response: { status: 409 } }), 'workflow.errors.conflict');
    assert.equal(toErrorCode({ response: { status: 500 } }), 'workflow.errors.requestFailed');
    assert.equal(toErrorCode(new Error('request failed')), 'workflow.errors.requestFailed');
});

test('requireCondition throws an ApplicationError with the supplied code', () => {
    assert.doesNotThrow(() => requireCondition(true));
    assert.throws(() => requireCondition(false, 'workflow.errors.custom'), (error) => {
        assert.ok(error instanceof ApplicationError);
        assert.equal(error.code, 'workflow.errors.custom');
        return true;
    });
});

test('tokenExpiration reads exp from a base64url JWT payload', () => {
    const expiresAt = 1_900_000_000;
    const payload = Buffer.from(JSON.stringify({ exp: expiresAt })).toString('base64url');
    const token = `${Buffer.from('{}').toString('base64url')}.${payload}.signature`;
    assert.equal(tokenExpiration(token), expiresAt * 1000);
});

test('tokenExpiration uses the 12-hour fallback for malformed tokens', () => {
    const before = Date.now();
    const expiration = tokenExpiration('not-a-jwt');
    const after = Date.now();
    assert.ok(expiration >= before + 12 * 60 * 60 * 1000);
    assert.ok(expiration <= after + 12 * 60 * 60 * 1000);
});

test('homeForRole returns the correct landing page for each role', () => {
    assert.equal(homeForRole(Roles.ADMIN), '/operations');
    assert.equal(homeForRole(Roles.GUIDE), '/field-guide/groups');
    assert.equal(homeForRole(Roles.TOURIST), '/tourist/expedition');
});

test('canAccessGroup enforces agency, role and membership boundaries', () => {
    const group = { id: 7, agencyId: 3, fieldGuideId: 12 };
    const admin = new User({ id: 1, role: Roles.ADMIN, agencyId: 3 });
    const guide = new User({ id: 2, role: Roles.GUIDE, agencyId: 3, fieldGuideId: 12 });
    const otherGuide = new User({ id: 3, role: Roles.GUIDE, agencyId: 3, fieldGuideId: 99 });
    const tourist = new User({ id: 4, role: Roles.TOURIST, agencyId: 3, identityDocument: 'DOC-4' });
    const members = [{ expeditionGroupId: 7, identityDocument: 'DOC-4' }];

    assert.equal(canAccessGroup(new User({ id: 5, role: Roles.ADMIN, agencyId: 8 }), group), false);
    assert.equal(canAccessGroup(admin, group), true);
    assert.equal(canAccessGroup(guide, group), true);
    assert.equal(canAccessGroup(otherGuide, group), false);
    assert.equal(canAccessGroup(tourist, group, members), true);
    assert.equal(canAccessGroup(tourist, group, [{ expeditionGroupId: 8, identityDocument: 'DOC-4' }]), false);
});

test('participant preparation normalizes a null emergency contact', () => {
    const preparation = ParticipantPreparationAssembler.toEntityFromResource({ id: 1, emergencyContact: null });
    assert.deepEqual(preparation.emergencyContact, {});
});

test('participant preparation is ready only when every required field is present', () => {
    const completePreparation = {
        id: 1,
        wearableId: 'wearable-1',
        consent: true,
        activated: true,
        emergencyContact: { name: 'Emergency contact', phone: '555-0100' },
    };
    assert.equal(ParticipantPreparationAssembler.toEntityFromResource(completePreparation).ready, true);

    for (const missing of [
        { wearableId: null },
        { consent: false },
        { activated: false },
        { emergencyContact: { name: 'Emergency contact', phone: '' } },
        { emergencyContact: { name: '', phone: '555-0100' } },
    ]) {
        assert.equal(ParticipantPreparationAssembler.toEntityFromResource({ ...completePreparation, ...missing }).ready, false);
    }
});
