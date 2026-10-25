export class SignInCommand {
    constructor(username, password) { this.username = username.trim().toLowerCase(); this.password = password; }
}
