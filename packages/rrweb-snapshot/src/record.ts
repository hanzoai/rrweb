// Record-only entry point that excludes replay/rebuild code
// This reduces bundle size for applications that only need recording functionality

import snapshot, {
  serializeNodeWithId,
  transformAttribute,
  ignoreAttribute,
  visitSnapshot,
  cleanupSnapshot,
  needMaskingText,
  classMatchesRegex,
  IGNORED_NODE,
  genId,
} from './snapshot';

export * from './types';
export * from './utils';
export * from './utils-snapshot';

export {
  snapshot,
  serializeNodeWithId,
  transformAttribute,
  ignoreAttribute,
  visitSnapshot,
  cleanupSnapshot,
  needMaskingText,
  classMatchesRegex,
  IGNORED_NODE,
  genId,
};
