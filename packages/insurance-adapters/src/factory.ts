import type { InsuranceAdapter } from './interface';
import { AxaAdapter } from './adapters/axa';
import { MetLifeAdapter } from './adapters/metlife';
import { AllianzAdapter } from './adapters/allianz';
import { GlobeMedAdapter } from './adapters/globemed';
import { MedmarkAdapter } from './adapters/medmark';

const adapters: Record<string, () => InsuranceAdapter> = {
  axa_egypt: () => new AxaAdapter(),
  metlife_egypt: () => new MetLifeAdapter(),
  allianz_egypt: () => new AllianzAdapter(),
  globemed_egypt: () => new GlobeMedAdapter(),
  medmark: () => new MedmarkAdapter(),
};

export function getAdapter(insurerCode: string): InsuranceAdapter {
  const factory = adapters[insurerCode];
  if (!factory) throw new Error(`No adapter for insurer: ${insurerCode}`);
  return factory();
}
