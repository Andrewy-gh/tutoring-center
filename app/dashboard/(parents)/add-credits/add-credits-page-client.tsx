'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AddCredits } from '@/components/add-credits';
import type { CreditBalance } from '@/lib/credit-balances';
import { purchaseParentCredits, type CreditMutationResult } from '@/lib/data/credit-mutations';

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
