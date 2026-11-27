/**
 * Readiness of a route within Expedition Setup. Enabling a route and starting an expedition on it are different steps
 * with different requirements; these functions mirror the checks of the server (Route.Enable and the expedition start
 * service) so the views can explain what is still missing before the request is sent.
 */

/** A window is valid when its minimum is zero or more and its maximum is greater than its minimum. */
function isValidWindow(window) {
    return Number.isFinite(window?.minimumMinutes) && window.minimumMinutes >= 0
        && Number.isFinite(window?.maximumMinutes) && window.maximumMinutes > window.minimumMinutes;
}

function orderedCheckpoints(checkpoints) {
    return [...checkpoints].sort((first, second) => first.sequenceOrder - second.sequenceOrder);
}

/**
 * @param {Object} params
 * @param {Checkpoint[]} params.checkpoints - Checkpoints of the route.
 * @returns {{key: string, met: boolean}[]} What the server requires to enable the route.
 */
export function enablementRequirements({ checkpoints = [] }) {
    return [{ key: 'checkpoint', met: checkpoints.length >= 1 }];
}

/** @returns {boolean} Whether the route can be enabled. */
export function canEnableRoute({ checkpoints = [] }) {
    return enablementRequirements({ checkpoints }).every((requirement) => requirement.met);
}

/**
 * @param {Object} params
 * @param {Checkpoint[]} params.checkpoints - Checkpoints of the route.
 * @param {ExpectedTimeWindow[]} params.windows - Expected time windows of the route.
 * @returns {{from: Checkpoint, to: Checkpoint}[]} Consecutive segments without a valid expected time window.
 */
export function segmentsWithoutWindow({ checkpoints = [], windows = [] }) {
    const ordered = orderedCheckpoints(checkpoints);
    return ordered.slice(0, -1)
        .map((from, index) => ({ from, to: ordered[index + 1] }))
        .filter(({ from, to }) => !windows.some((window) => (
            window.fromCheckpointId === from.id && window.toCheckpointId === to.id && isValidWindow(window)
        )));
}

/**
 * @param {Object} params
 * @param {Route} params.route - The route.
 * @param {Checkpoint[]} params.checkpoints - Checkpoints of the route.
 * @param {ExpectedTimeWindow[]} params.windows - Expected time windows of the route.
 * @returns {{key: string, met: boolean, missing?: number}[]} What the route itself still needs before an expedition
 *     can start on it, beyond being enabled.
 */
export function routeStartRequirements({ route, checkpoints = [], windows = [] }) {
    const missingWindows = checkpoints.length >= 2 ? segmentsWithoutWindow({ checkpoints, windows }).length : null;
    return [
        { key: 'enabled', met: route?.status === 'enabled' },
        { key: 'twoCheckpoints', met: checkpoints.length >= 2 },
        { key: 'timeWindows', met: missingWindows === 0, missing: missingWindows ?? 0 },
    ];
}

/**
 * Requirements checked when an expedition starts that belong to the preparation of each group, not to the route.
 */
export const GROUP_START_REQUIREMENTS = Object.freeze(['protocol', 'participants']);
