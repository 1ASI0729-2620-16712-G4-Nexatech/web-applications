import { User } from '../domain/user.entity.js';

export class UserAssembler {
    static toEntityFromResource(resource) { return new User(resource); }
    static toEntitiesFromResponse(response) { return response.data.map((resource) => this.toEntityFromResource(resource)); }
}
