import { forbidden } from 'next/navigation';
import { AddCreditsPageClient } from '@/features/credits/add-credits/add-credits-page-client';
import { getCurrentParentCredits } from '@/features/credits/server';
import { getUserRole } from '@/lib/auth';

export default async function AddCreditsPage() {
  const role = await getUserRole();

  if (role !== 'parent') {
    forbidden();
  }

  const parentCredits = await getCurrentParentCredits();

  return <AddCreditsPageClient parentId={parentCredits.parentId} initialBalance={parentCredits.balance} />;
}
