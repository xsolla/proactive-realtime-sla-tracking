export { createDatabase, getDatabase, type Database } from "./db";
export {
  loadOutages,
  partitionOutages,
  summarizeOutageHealth,
  UNUSABLE_REASONS,
  type OutageHealth,
  type OutagePartition,
  type OutageSourceRow,
  type UnusableOutage,
  type UnusableReason,
  type UsableOutage,
} from "./outages";
export { slaAlertState } from "./schema/alert-state";
export { slaOutages } from "./schema/outages";
