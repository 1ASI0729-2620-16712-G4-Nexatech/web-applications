import { BaseApi } from '../../shared/infrastructure/base-api.js';

/** API gateway for the IAM bounded context of the VitalTrek RESTful API. */
export class IamApi extends BaseApi {
    signIn(command) {
        return this.http.post('/authentication/sign-in', { username: command.username, password: command.password });
    }
    signUp(command) {
        return this.http.post('/authentication/sign-up', { agencyName: command.agencyName, name: command.name, username: command.username, password: command.password });
    }
    getUsers() { return this.http.get('/users'); }
    createUser(resource) { return this.http.post('/users', resource); }
}
