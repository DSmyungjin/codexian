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
