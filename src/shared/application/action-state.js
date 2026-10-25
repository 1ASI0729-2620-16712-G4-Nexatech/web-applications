import { ref } from 'vue';

export function createActionState() {
    const pending = ref(0);
    const error = ref('');
    async function run(action) {
        pending.value += 1;
        error.value = '';
        try { return await action(); }
        catch (cause) { error.value = cause.code?.startsWith('workflow.') ? cause.code : 'workflow.errors.requestFailed'; throw cause; }
        finally { pending.value -= 1; }
    }
    return { pending, error, run };
}
