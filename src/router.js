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
const routes = [
    {
        path: '/',
        redirect: '/operations/routes',
    },
    {
        path: '/operations/routes',
        name: 'routes',
        component: routeListView,
        meta: { title: 'Routes' },
    },
    {
        path: '/operations/routes/new',
        name: 'route-new',
        component: routeFormView,
        meta: { title: 'New Route' },
    },

    {
        path: '/operations/routes/:routeId/checkpoints',
        name: 'route-checkpoints',
        component: checkpointConfigurationView,
        meta: { title: 'Checkpoints' },
    },
    {
        path: '/operations/routes/:routeId/expected-time-windows',
        name: 'route-expected-time-windows',
        component: expectedTimeWindowConfigurationView,
        meta: { title: 'Expected Time Windows' },
    },
    {
        path: '/operations/routes/:routeId/groups',
        name: 'route-groups',
        component: expeditionGroupConfigurationView,
        meta: { title: 'Expedition Groups' },
    },
    {
        path: '/operations/routes/:routeId/groups/:groupId/manifest',
        name: 'group-manifest',
        component: touristManifestView,
        meta: { title: 'Tourist Manifest' },
    },
    {
        path: '/operations/progress',
        name: 'group-progress-dashboard',
        component: groupProgressDashboardView,
        meta: { title: 'Group Progress' },
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