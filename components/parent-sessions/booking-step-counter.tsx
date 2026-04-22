import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

type BookingStepCounterProps = {
  currentStep: number;
  totalSteps: number;
  currentStepLabel: string;
};

export function BookingStepCounter({ currentStep, totalSteps, currentStepLabel }: BookingStepCounterProps) {
  const completionPercent = (currentStep / totalSteps) * 100;

  return (
    <Card className='border-primary/15 bg-muted/30'>
      <CardContent className='space-y-4 p-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='space-y-1'>
            <p className='text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase'>Booking progress</p>
            <p className='text-lg font-semibold'>
              Step {currentStep} of {totalSteps}
            </p>
            <p className='text-sm text-muted-foreground'>Current step: {currentStepLabel}</p>
          </div>
          <Badge variant='secondary'>
            {currentStep}/{totalSteps}
          </Badge>
        </div>

        <div
          aria-label={`Step ${currentStep} of ${totalSteps}`}
          aria-valuemax={totalSteps}
          aria-valuemin={1}
          aria-valuenow={currentStep}
          className='bg-border h-2 w-full rounded-full'
          role='progressbar'
        >
          <div
            className='bg-primary h-full rounded-full transition-[width]'
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
