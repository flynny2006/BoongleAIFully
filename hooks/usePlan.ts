
import { useState, useEffect, useCallback } from 'react';

export type PlanTier = 'FREE' | 'PRO' | 'PREMIUM';

const LOCAL_STORAGE_KEY = 'userActivePlan';
const PRO_CLAIM_CODE = '3636';

interface UsePlanOutput {
  plan: PlanTier;
  isProOrHigher: boolean;
  isPremium: boolean;
  setPlan: (newPlan: PlanTier) => void;
  claimProWithCode: (code: string) => boolean;
  canAccessEditor: boolean;
}

export const usePlan = (): UsePlanOutput => {
  const [plan, setCurrentPlan] = useState<PlanTier>(() => {
    const storedPlan = localStorage.getItem(LOCAL_STORAGE_KEY);
    return (storedPlan as PlanTier) || 'FREE';
  });

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, plan);
  }, [plan]);

  const setPlan = useCallback((newPlan: PlanTier) => {
    setCurrentPlan(newPlan);
  }, []);

  const claimProWithCode = useCallback((code: string): boolean => {
    if (code === PRO_CLAIM_CODE) {
      setCurrentPlan('PRO');
      return true;
    }
    return false;
  }, []);

  const isProOrHigher = plan === 'PRO' || plan === 'PREMIUM';
  const isPremium = plan === 'PREMIUM';
  const canAccessEditor = isProOrHigher; // Editor access for PRO or PREMIUM

  return {
    plan,
    isProOrHigher,
    isPremium,
    setPlan,
    claimProWithCode,
    canAccessEditor,
  };
};
