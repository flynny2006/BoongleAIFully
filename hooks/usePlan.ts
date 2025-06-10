
import { useState, useEffect, useCallback } from 'react';

export type PlanTier = 'FREE' | 'PRO' | 'PREMIUM';

const LOCAL_STORAGE_KEY = 'userActivePlan';
const PRO_CLAIM_CODE = '3636'; 
const FREE_CLAIM_CODE = 'FREEBIE00'; // New code for downgrading to FREE
// One could add more codes, e.g., const PREMIUM_CLAIM_CODE = 'PREMIUM_ACCESS';

interface UsePlanOutput {
  plan: PlanTier;
  isProOrHigher: boolean;
  isPremium: boolean;
  setPlan: (newPlan: PlanTier) => void;
  claimPlanWithCode: (code: string) => PlanTier | null; // Changed from claimProWithCode
  canAccessEditor: boolean;
}

export const usePlan = (): UsePlanOutput => {
  const [plan, setCurrentPlan] = useState<PlanTier>(() => {
    const storedPlan = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedPlan === 'FREE' || storedPlan === 'PRO' || storedPlan === 'PREMIUM') {
      return storedPlan;
    }
    return 'FREE'; 
  });

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, plan);
  }, [plan]);

  const setPlan = useCallback((newPlan: PlanTier) => {
    setCurrentPlan(newPlan);
  }, []);

  // Generalized claim code logic
  const claimPlanWithCode = useCallback((code: string): PlanTier | null => {
    const upperCaseCode = code.toUpperCase();
    if (upperCaseCode === PRO_CLAIM_CODE) {
      setCurrentPlan('PRO');
      return 'PRO';
    }
    if (upperCaseCode === FREE_CLAIM_CODE) {
      setCurrentPlan('FREE');
      return 'FREE';
    }
    // Example for a premium code, if it were implemented:
    // if (upperCaseCode === 'PREMIUM_CODE_EXAMPLE') { // Remember to define this constant
    //   setCurrentPlan('PREMIUM');
    //   return 'PREMIUM';
    // }
    return null; // Code not recognized
  }, [setCurrentPlan]);


  const isProOrHigher = plan === 'PRO' || plan === 'PREMIUM';
  const isPremium = plan === 'PREMIUM';
  const canAccessEditor = isProOrHigher;

  return {
    plan,
    isProOrHigher,
    isPremium,
    setPlan, 
    claimPlanWithCode, // Updated function name
    canAccessEditor,
  };
};
