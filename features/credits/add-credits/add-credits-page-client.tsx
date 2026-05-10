'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AddCredits } from '@/features/credits/add-credits/add-credits';
import {
  purchaseParentCredits,
  type CreditPurchaseResult,
} from '@/features/credits/add-credits/purchase-parent-credits';
import { type CreditBalance } from '@/features/credits/credit-balances';

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
        const result: CreditPurchaseResult = await purchaseParentCredits(parentId, purchase.pkg.credits, balance);

        setBalance(result.balance);
        setWarning(result.warning ?? null);
        router.refresh();
      }}
    />
  );
}
