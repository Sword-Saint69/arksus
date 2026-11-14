import { useMemo } from 'react';
import { decide, inputsFromDefaults, summarize, type Decision, type RotationSummary } from '@/lib/economics';
import type { Field } from '@/auth/accounts';
import { weightsFor } from '@/utils/priorities';
import { useLocationData, type SiteData } from './useSiteData';

export type FieldVerdict = {
  decision: Decision;
  summaries: RotationSummary[];
  fallow: RotationSummary;
  chosen: RotationSummary | null;
};

/** The same decide()/summarize() the analysis page uses, for one saved field. */
export function useFieldVerdict(data: SiteData, field: Field | null): { status: 'loading' | 'error' | 'ready'; verdict: FieldVerdict | null } {
  const loc = useLocationData(field?.locationId ?? null);
  const verdict = useMemo(() => {
    if (!field || loc.status !== 'ready') return null;
    const inputs = inputsFromDefaults(data.defaults);
    const w = weightsFor(field.priority, inputs.weights);
    const decision = decide(loc.data.results, data.site, field.depthId, inputs, w);
    const summaries = summarize(loc.data.results, data.site, field.depthId);
    const fallow = summaries.find((s) => s.is_baseline) ?? summaries[0];
    const chosen = summaries.find((s) => s.rotation_id === decision.recommended) ?? null;
    return { decision, summaries, fallow, chosen };
  }, [data, field, loc]);
  return { status: !field ? 'error' : loc.status, verdict };
}
