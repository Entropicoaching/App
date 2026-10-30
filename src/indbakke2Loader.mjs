import { registryHooks } from './testModuleRegistry.mjs'
export function install() { return registryHooks(import.meta.url)({}) }
