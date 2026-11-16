// ORDRE 1537b · Workerens indgang. Al logik ligger i src/videolager/worker.js, så den prøves af `npm test`.
import { handleVideolager } from '../../src/videolager/worker.js'

export default { fetch: (request, env) => handleVideolager(request, env) }
