import { cn } from '@/lib/utils';

type BookingStepCounterProps = {
  currentStep: number;
  totalSteps: number;
  currentStepLabel: string;
  stepLabels: string[];
};

export function BookingStepCounter({ currentStep, totalSteps, currentStepLabel, stepLabels }: BookingStepCounterProps) {
  const steps = Array.from({ length: totalSteps }, (_, index) => index + 1);

  return (
    <div className='space-y-5'>
      <div className='space-y-1'>
        <p className='text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase'>Booking progress</p>
        <p className='text-lg font-semibold'>
          Step {currentStep} of {totalSteps}
        </p>
      </div>

      <div aria-label={`Step ${currentStep} of ${totalSteps}: ${currentStepLabel}`} className='flex items-center' role='list'>
        {steps.map(step => {
          const isComplete = step < currentStep;
          const isCurrent = step === currentStep;
          const stepStatus = isCurrent ? 'current step' : isComplete ? 'completed' : 'not started';
          const stepLabel = stepLabels[step - 1];

          return (
            <div
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`Step ${step} of ${totalSteps}: ${stepLabel}, ${stepStatus}`}
              className='flex flex-1 items-center last:flex-none'
              key={step}
              role='listitem'
            >
              <div
                aria-hidden='true'
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                  isComplete && 'border-primary bg-muted text-primary',
                  isCurrent && 'border-primary bg-muted text-primary',
                  !isComplete && !isCurrent && 'border-muted-foreground/45 bg-muted text-muted-foreground'
                )}
              >
                {step}
              </div>
              {step < totalSteps ? (
                <div
                  aria-hidden='true'
                  className={cn(
                    'mx-1 h-1 min-w-0 flex-1 rounded-full transition-colors sm:mx-2 sm:min-w-8',
                    isComplete ? 'bg-primary' : 'bg-muted-foreground/35'
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
