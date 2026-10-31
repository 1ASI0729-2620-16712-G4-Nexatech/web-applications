export class ApplicationError extends Error {
    constructor(code) { super(code); this.code = code; }
}

export function requireCondition(condition, code = 'workflow.errors.invalid') {
    if (!condition) throw new ApplicationError(code);
}

const errorCodesByStatus = {
    400: 'workflow.errors.invalid',
    401: 'workflow.errors.sessionExpired',
    403: 'workflow.errors.forbidden',
    404: 'workflow.errors.notFound',
    409: 'workflow.errors.conflict',
};

/** Translates application errors and API responses into i18n message keys. */
export function toErrorCode(cause) {
    if (typeof cause?.code === 'string' && cause.code.startsWith('workflow.')) return cause.code;
    return errorCodesByStatus[cause?.response?.status] ?? 'workflow.errors.requestFailed';
}
