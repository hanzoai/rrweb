import record from '../record';
import { _mirror } from '../utils';
import * as utils from '../utils';

export {
  EventType,
  IncrementalSource,
  MouseInteractions,
  type eventWithTime,
} from '@posthog/rrweb-types';

export type { recordOptions } from '../types';

const { addCustomEvent } = record;
const { freezePage } = record;
const { takeFullSnapshot } = record;

export {
  record,
  addCustomEvent,
  freezePage,
  takeFullSnapshot,
  _mirror as mirror,
  utils,
};
