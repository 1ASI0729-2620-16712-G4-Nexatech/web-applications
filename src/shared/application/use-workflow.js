import { ref } from 'vue';
import { toErrorCode } from '../domain/application-error.js';
export function useWorkflow() {
    const busy = ref(false), error = ref(''), message = ref('');
    async function execute(action, success = 'workflow.saved') {
        if (busy.value) return null;
        busy.value = true; error.value = ''; message.value = '';
        try { const result = await action(); message.value = success; return result ?? true; }
        catch (cause) { error.value = toErrorCode(cause); return null; }
        finally { busy.value = false; }
    }
    return { busy, error, message, execute };
}
