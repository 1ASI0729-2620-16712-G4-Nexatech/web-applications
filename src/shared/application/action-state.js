import { ref } from 'vue';
import { toErrorCode } from '../domain/application-error.js';

export function createActionState() {
    const pending = ref(0);
    const error = ref('');
    async function run(action) {
        pending.value += 1;
        error.value = '';
        try { return await action(); }
        catch (cause) { error.value = toErrorCode(cause); throw cause; }
        finally { pending.value -= 1; }
    }
    return { pending, error, run };
}
