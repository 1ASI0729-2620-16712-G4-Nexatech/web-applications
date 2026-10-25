export class ApplicationError extends Error {
    constructor(code) { super(code); this.code = code; }
}

export function requireCondition(condition, code = 'workflow.errors.invalid') {
    if (!condition) throw new ApplicationError(code);
}
