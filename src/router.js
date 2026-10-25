import { authenticationGuard } from './iam/infrastructure/authentication.guard.js';
import { Roles, homeForRole } from './iam/domain/user.entity.js';
import { readSession } from './iam/infrastructure/iam-session.js';
import { createRouter, createWebHistory } from 'vue-router';

const routeListView = () => import(
    './expedition-setup/presentation/views/RouteListView.vue'
    );

const routeFormView = () => import(
    './expedition-setup/presentation/views/RouteFormView.vue'
    );

const checkpointConfigurationView = () => import(
    './expedition-setup/presentation/views/CheckpointConfigurationView.vue'
    );
const expectedTimeWindowConfigurationView = () => import(
    './expedition-setup/presentation/views/ExpectedTimeWindowConfigurationView.vue'
    );
const expeditionGroupConfigurationView = () => import(
    './expedition-setup/presentation/views/ExpeditionGroupConfigurationView.vue'
    );
const touristManifestView = () => import(
    './expedition-setup/presentation/views/TouristManifestView.vue'
    );
const groupProgressDashboardView = () => import(
    './field-tracking/presentation/views/GroupProgressDashboardView.vue'
    );
const earlyWarningAlertDashboardView = () => import(
    './safety-monitoring/presentation/views/EarlyWarningAlertDashboardView.vue'
    );
const roleSelectionView = () => import(
    './iam/presentation/views/SignInView.vue'
    );

const operationsDashboardView = () => import(
    './shared/presentation/views/OperationsDashboardView.vue'
    );

const fieldGuideWorkspaceView = () => import(
    './expedition-setup/presentation/views/ExpeditionListView.vue'
    );
const operationsMeta = (title) => ({
    title,
    workspace: 'operations',
    roles: [Roles.ADMIN],
});

const fieldGuideMeta = (title) => ({
    title,
    workspace: 'field-guide',
    roles: [Roles.GUIDE],
});
const routes = [
    { path: '/', redirect: () => { const session = readSession(); return session ? homeForRole(session.user.role) : '/sign-in'; } },
    { path: '/operations/expeditions', name: 'expeditions', component: () => import('./expedition-setup/presentation/views/ExpeditionListView.vue'), meta: operationsMeta('Expeditions') },
    { path: '/operations/groups/:groupId', name: 'operations-expedition', component: () => import('./expedition-setup/presentation/views/ExpeditionWorkspaceView.vue'), meta: operationsMeta('Expedition') },
    { path: '/operations/groups/:groupId/manifest', name: 'operations-manifest', component: touristManifestView, meta: operationsMeta('Manifest') },
    { path: '/field-guide/groups/:groupId', name: 'guide-expedition', component: () => import('./expedition-setup/presentation/views/ExpeditionWorkspaceView.vue'), meta: fieldGuideMeta('Expedition') },
    { path: '/operations/accounts', name: 'accounts', component: () => import('./iam/presentation/views/AccountsView.vue'), meta: operationsMeta('Accounts') },
    { path: '/tourist/expedition', name: 'tourist-expedition', component: () => import('./field-tracking/presentation/views/TouristExpeditionView.vue'), meta: { title: 'My expedition', workspace: 'tourist', roles: [Roles.TOURIST] } },
    { path: '/forbidden', name: 'forbidden', component: () => import('./shared/presentation/views/StatusView.vue'), props: { kind: 'forbidden' }, meta: { public: true } },
    { path: '/connection-error', name: 'connection-error', component: () => import('./shared/presentation/views/StatusView.vue'), props: { kind: 'connectionError' }, meta: { public: true } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('./shared/presentation/views/StatusView.vue'), meta: { public: true } },
    {
        path: '/sign-in',
        name: 'iam-sign-in',
        component: roleSelectionView,
        meta: { title: 'Sign in', public: true },
    },
    {
        path: '/operations',
        name: 'operations-dashboard',
        component: operationsDashboardView,
        meta: operationsMeta('Dashboard'),
    },
    {
        path: '/operations/routes',
        name: 'routes',
        component: routeListView,
        meta: operationsMeta('Routes'),
    },
    {
        path: '/operations/routes/new',
        name: 'route-new',
        component: routeFormView,
        meta: operationsMeta('New Route'),
    },
    {
        path: '/operations/routes/:routeId/checkpoints',
        name: 'route-checkpoints',
        component: checkpointConfigurationView,
        meta: operationsMeta('Checkpoints'),
    },
    {
        path: '/operations/routes/:routeId/expected-time-windows',
        name: 'route-expected-time-windows',
        component: expectedTimeWindowConfigurationView,
        meta: operationsMeta('Expected Time Windows'),
    },
    {
        path: '/operations/routes/:routeId/groups',
        name: 'route-groups',
        component: expeditionGroupConfigurationView,
        meta: operationsMeta('Expedition Groups'),
    },
    {
        path: '/operations/progress',
        name: 'group-progress-dashboard',
        component: groupProgressDashboardView,
        meta: operationsMeta('Group Progress'),
    },
    {
        path: '/operations/alerts',
        name: 'early-warning-alerts',
        component: earlyWarningAlertDashboardView,
        meta: operationsMeta('Early Warning Alerts'),
    },
    {
        path: '/field-guide/groups',
        name: 'field-guide-workspace',
        component: fieldGuideWorkspaceView,
        meta: fieldGuideMeta('Field Workspace'),
    },
    {
        path: '/field-guide/groups/:groupId/manifest',
        name: 'field-guide-manifest',
        component: touristManifestView,
        meta: fieldGuideMeta('Tourist Manifest'),
    },
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
});

router.beforeEach((to) => {
    const pageTitle = to.meta.title ?? 'Operations';
    document.title = `VitalTrek - ${pageTitle}`;
    return authenticationGuard(to);
});

export default router;