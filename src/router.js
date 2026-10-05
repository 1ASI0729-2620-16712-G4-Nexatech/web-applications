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
    './shared/presentation/views/RoleSelectionView.vue'
    );

const operationsDashboardView = () => import(
    './shared/presentation/views/OperationsDashboardView.vue'
    );

const fieldGuideWorkspaceView = () => import(
    './expedition-setup/presentation/views/FieldGuideWorkspaceView.vue'
    );
const operationsMeta = (title) => ({
    title,
    workspace: 'operations',
});

const fieldGuideMeta = (title) => ({
    title,
    workspace: 'field-guide',
});
const routes = [
    {
        path: '/',
        name: 'role-selection',
        component: roleSelectionView,
        meta: { title: 'Select workspace' },
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
    return true;
});

export default router;