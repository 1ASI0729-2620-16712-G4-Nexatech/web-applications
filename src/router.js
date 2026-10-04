import { createRouter, createWebHistory } from 'vue-router';

const routeListView = () => import(
    './expedition-setup/presentation/views/RouteListView.vue'
    );

const routeFormView = () => import(
    './expedition-setup/presentation/views/RouteFormView.vue'
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