/**
 * Enables the operational bounded contexts that are not yet implemented in the RESTful API.
 * They run against the json-server Fake API only when VITE_SIMULATED_OPERATIONS is 'true'.
 */
export const simulatedOperationsEnabled = import.meta.env.VITE_SIMULATED_OPERATIONS === 'true';
