'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { purchaseParentCredits, type CreditBalance, type CreditMutationResult } from '@/features/credits';
import { AddCredits } from '@/features/credits/add-credits';

type AddCreditsPageClientProps = {
  parentId: number;
  initialBalance: CreditBalance;
};

export function AddCreditsPageClient({ parentId, initialBalance }: AddCreditsPageClientProps) {
  const router = useRouter();
  const [balance, setBalance] = useState(initialBalance);
  const [warning, setWarning] = useState<string | null>(null);

  return (
    <AddCredits
      warningMessage={warning}
      onPurchaseCompleteAction={async purchase => {
        const result: CreditMutationResult = await purchaseParentCredits(parentId, purchase.pkg.credits, balance);

        setBalance(result.balance);
        setWarning(result.warning ?? null);
        router.refresh();
      }}
    />
  );
}
