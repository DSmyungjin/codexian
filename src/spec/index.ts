export * from './contract.js';
export { locateSpecDir, defaultSpecDir } from './locate.js';
export { init, writeContextDoc, type InitOptions, type InitResult } from './init.js';
export { validate, type ValidationReport, type ValidationIssue } from './validate.js';
export { seal, type SealOptions, type SealResult } from './seal.js';
export { doctor, formatReport, type DoctorReport, type CheckResult, type CheckStatus } from './doctor.js';
export {
  recordCompletion,
  RecordCompletionError,
  type RecordCompletionOptions,
  type RecordCompletionResult,
} from './record-completion.js';
export {
  recordVerifyFailure,
  RecordVerifyFailureError,
  type RecordVerifyFailureOptions,
  type RecordVerifyFailureResult,
} from './record-verify-failure.js';
export { readTemplateSpecBlock, mergeAgentsHeritage, type AgentsMergeAction, type AgentsMergeResult } from './agents-merge.js';
export { execWrapper, type ExecWrapperArgs, type ExecWrapperResult } from './exec-wrapper.js';
export {
  extractTeamTasks,
  formatTeamTasks,
  TeamTasksError,
  type TeamTaskCandidate,
  type TeamTasksOptions,
  type FormatOptions,
} from './team-tasks.js';
export {
  registerHook,
  computeTrustHash,
  HookRegisterError,
  type HookRegisterOptions,
  type HookRegisterResult,
  type HookEntryAction,
  type TrustAction,
} from './hook-register.js';
