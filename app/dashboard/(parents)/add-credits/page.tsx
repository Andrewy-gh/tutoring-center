import { forbidden } from 'next/navigation';
import { getCurrentParentCredits } from '@/features/credits/server';
import { getUserRole } from '@/lib/auth';
import { AddCreditsPageClient } from './add-credits-page-client';

export default async function AddCreditsPage() {
  const role = await getUserRole();

  if (role !== 'parent') {
    forbidden();
  }

  const parentCredits = await getCurrentParentCredits();

  return <AddCreditsPageClient parentId={parentCredits.parentId} initialBalance={parentCredits.balance} />;
}
