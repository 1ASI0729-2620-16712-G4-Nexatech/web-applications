export class SignUpCommand {
    constructor({ agencyName, name, username, password }) {
        Object.assign(this, { agencyName: agencyName.trim(), name: name.trim(), username: username.trim().toLowerCase(), password });
    }
}
