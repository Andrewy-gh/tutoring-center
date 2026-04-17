import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { creditsToMinutes, formatHours, minutesToHours } from '@/lib/billing-units';
import { getCurrentParentBalance } from '@/lib/data/parent-credits';
import { AlertCircle, Coins } from 'lucide-react';

const LOW_THRESHOLD_HOURS = 2;
const MEDIUM_THRESHOLD_HOURS = 5;
const LOW_THRESHOLD = creditsToMinutes(LOW_THRESHOLD_HOURS);
const MEDIUM_THRESHOLD = creditsToMinutes(MEDIUM_THRESHOLD_HOURS);

function balanceColor(amount: number) {
  if (amount < LOW_THRESHOLD) return 'text-red-600';
  if (amount < MEDIUM_THRESHOLD) return 'text-amber-500';
  return '';
}

function borderColor(amount: number) {
  if (amount < LOW_THRESHOLD) return 'border-red-500';
  if (amount < MEDIUM_THRESHOLD) return 'border-amber-500';
  return 'border-border';
}

export async function ParentCreditWidget() {
  const { available_minutes } = await getCurrentParentBalance();
  const availableHours = minutesToHours(available_minutes);

  return (
    <div className='px-2 py-1'>
      <div className={`rounded-2xl bg-muted/30 border border-border p-3 space-y-2 ${borderColor(available_minutes)}`}>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-1.5'>
            <Coins size={14} className='text-muted-foreground' />
            <span className='text-xs uppercase tracking-wide text-muted-foreground font-semibold'>Tutor Credits</span>
          </div>
          {available_minutes < MEDIUM_THRESHOLD && (
            <AlertCircle
              size={13}
              className={available_minutes < LOW_THRESHOLD ? 'text-red-500' : 'text-amber-500'}
            />
          )}
        </div>
        <div>
          <p className={`text-xl font-bold ${balanceColor(available_minutes)}`}>
            {formatHours(availableHours)} <span className='text-sm'>{availableHours === 1 ? 'hour' : 'hours'} available</span>
          </p>
          {available_minutes < LOW_THRESHOLD && (
            <p className='text-xs text-red-500 mt-0.5'>Low credits - please consider topping up.</p>
          )}
        </div>
        <Button asChild size='sm' className='w-full'>
          <Link href='/dashboard/add-credits'>+ Add Credits</Link>
        </Button>
      </div>
    </div>
  );
}
