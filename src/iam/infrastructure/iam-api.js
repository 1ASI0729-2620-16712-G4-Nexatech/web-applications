import { BaseApi } from '../../shared/infrastructure/base-api.js';

/** Academic adapter. json-server accounts simulate authentication; no real identity provider. */
export class IamApi extends BaseApi {
    async signIn(command) {
        const response = await this.http.get('/users', { params: { username: command.username } });
        return response.data.find((user) => user.password === command.password) ?? null;
    }
    getUsers(agencyId) { return this.http.get('/users', { params: { agencyId } }); }
    createUser(resource) { return this.http.post('/users', resource); }
    createAgency(resource) { return this.http.post('/agencies', resource); }
    findUsername(username) { return this.http.get('/users', { params: { username } }); }
    deleteAgency(id) { return this.http.delete(`/agencies/${id}`); }
    getGuides(agencyId, id) { return this.http.get('/field-guides', { params: { agencyId, id } }); }
    getManifest(agencyId, identityDocument) { return this.http.get('/manifest-entries', { params: { agencyId, identityDocument } }); }
}
