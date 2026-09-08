// The four stores the TACO gate reads, gathered once so every screen asks the
// same question (docs/PLAN-endgame.md step 3). Storage access lives here, not
// in progressionLaw, which stays pure.
import { listRunRecords } from './runRecord';
import { listMachineVersions } from './machineVersions';
import { latestBasket } from './basket';
import { listGauntletRecords } from './gauntlet';
import type { TacoEvidence } from './progressionLaw';

export function readTacoEvidence(): TacoEvidence {
  return {
    records: listRunRecords(),
    machineCompiled: listMachineVersions().length > 0,
    basketLocked: latestBasket() !== null,
    gauntletRun: listGauntletRecords().length > 0,
  };
}
