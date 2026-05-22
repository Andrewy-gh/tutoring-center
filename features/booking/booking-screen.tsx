'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { SuccessCard } from '@/components/success-card';
import { Card, CardContent } from '@/components/ui/card';
import {
  getBookingProgress,
  getSessionDurationMinutes,
  getSessionSlotUnits,
  selectTutorsForSubject,
  shouldBlockForCredits,
  shouldStartAtSubjectStep,
} from '@/features/booking/booking-flow';
import { AddCredits, generateConfirmationCode, type CreditsPurchase } from '@/features/credits/add-credits/add-credits';
import { purchaseParentCredits } from '@/features/credits/add-credits/purchase-parent-credits';
import { type CreditBalance } from '@/features/credits/credit-balances';
import type { SubjectOption, SubjectSelection } from '@/features/subjects/subjects-service';
import { minutesToCredits, slotUnitsToMinutes } from '@/lib/billing-units';
import { formatSessionDateTime } from '@/lib/date-utils';
import { BookingStepCounter } from './booking-step-counter';
import { BookingSuccessDetails } from './booking-success-details';
import { LowCreditsToast } from './low-credits-toast';
import { PickDate } from './pick-date';
import { PickStudent } from './pick-student';
import { PickSubject } from './pick-subjects';
import { PickTutor } from './pick-tutors';
import type { Reservation, StudentOption, TutorOption } from './types';

type BookingState =
  | { step: 'student' }
  | { step: 'subject'; student: StudentOption }
  | { step: 'tutor'; student: StudentOption; selection: SubjectSelection }
  | { step: 'date'; student: StudentOption; selection: SubjectSelection; tutor: TutorOption; subjectId: number }
  | { step: 'credits'; reservation: Reservation; selection: SubjectSelection }
  | {
      step: 'success';
      reservation: Reservation;
      purchase?: CreditsPurchase;
      confirmationCode: string;
      warning?: string;
    };

type BookingScreenProps = {
  parentId: number;
  initialBalance: CreditBalance;
  students: StudentOption[];
  subjects: SubjectOption[];
  tutors: TutorOption[];
  todayStartMs: number;
};

const getFirstName = (fullName: string) => fullName.trim().split(/\s+/)[0] || '';

export function BookingScreen({
  parentId,
  initialBalance,
  students,
  subjects,
  tutors,
  todayStartMs,
}: BookingScreenProps) {
  const router = useRouter();
  const [balance, setBalance] = useState(initialBalance);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isLowCreditsToastDismissed, setIsLowCreditsToastDismissed] = useState(false);
  const [bookingState, setBookingState] = useState<BookingState>(() => {
    if (shouldStartAtSubjectStep(students)) {
      return { step: 'subject', student: students[0] };
    }
    return { step: 'student' };
  });

  useEffect(() => {
    if (balance.available_minutes > 0) {
      setIsLowCreditsToastDismissed(false);
    }
  }, [balance.available_minutes]);

  if (students.length === 0) {
    return <main className='mx-auto max-w-3xl p-6'>No students found.</main>;
  }

  const lowCreditsToast =
    balance.available_minutes === 0 && !isLowCreditsToastDismissed ? (
      <LowCreditsToast
        availableMinutes={balance.available_minutes}
        onAddCredits={() => router.push('/dashboard/add-credits')}
        onDismiss={() => setIsLowCreditsToastDismissed(true)}
      />
    ) : null;

  function renderStep(
    step: 'student' | 'subject' | 'tutor' | 'date' | 'credits',
    content: ReactNode,
    error?: string | null
  ) {
    const progress = getBookingProgress(step, students.length);

    return (
      <>
        {lowCreditsToast}
        <div className='mx-auto w-full max-w-3xl px-6 pt-6 pb-0'>
          <BookingStepCounter
            currentStep={progress.currentStep}
            totalSteps={progress.totalSteps}
            currentStepLabel={progress.currentStepLabel}
            stepLabels={progress.stepLabels}
          />
        </div>
        {error ? (
          <p className='mx-auto mt-6 w-full max-w-3xl rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
            {error}
          </p>
        ) : null}
        {content}
      </>
    );
  }

  async function createSession(reservation: Reservation) {
    const slotUnits = getSessionSlotUnits(reservation.session);

    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tutor_id: reservation.tutor.id,
        student_id: reservation.student.id,
        subject_id: reservation.subject.id,
        slot_units: slotUnits,
        scheduled_at: reservation.session.scheduled_at,
        ends_at: reservation.session.ends_at,
      }),
    });

    const body = (await response.json().catch(() => null)) as { data?: { id?: number }; error?: string } | null;
    if (!response.ok) {
      throw new Error(body?.error ?? 'Could not complete booking right now. Please try again.');
    }

    const sessionId = body?.data?.id;
    if (typeof sessionId !== 'number') {
      throw new Error('Session was created without an id.');
    }

    return sessionId;
  }

  async function completeBooking(reservation: Reservation, purchase?: CreditsPurchase, warning?: string) {
    const reservedMinutes = getSessionDurationMinutes(reservation.session);

    setCheckoutError(null);
    await createSession(reservation);
    setBalance(currentBalance => ({
      available_minutes: currentBalance.available_minutes - reservedMinutes,
      pending_minutes: currentBalance.pending_minutes + reservedMinutes,
    }));

    setBookingState({
      step: 'success',
      reservation,
      purchase,
      confirmationCode: generateConfirmationCode(),
      warning,
    });
    router.refresh();
  }

  switch (bookingState.step) {
    case 'student':
      return renderStep(
        'student',
        <PickStudent
          students={students}
          onSelect={student => setBookingState({ step: 'subject', student })}
          onBack={() => router.back()}
        />
      );
    case 'subject':
      return renderStep(
        'subject',
        <PickSubject
          subjects={subjects}
          studentFirstName={getFirstName(bookingState.student.name)}
          onSelectAction={selection => setBookingState({ step: 'tutor', student: bookingState.student, selection })}
          onBackAction={() => {
            if (students.length === 1) {
              router.back();
            } else {
              setBookingState({ step: 'student' });
            }
          }}
        />
      );
    case 'tutor': {
      const tutorOptions = selectTutorsForSubject(tutors, bookingState.selection);

      return renderStep(
        'tutor',
        <PickTutor
          subject={bookingState.selection.subject}
          assignments={bookingState.selection.assignments}
          tutors={tutorOptions}
          onSelect={({ tutor, subjectId }) =>
            setBookingState({
              step: 'date',
              student: bookingState.student,
              selection: bookingState.selection,
              tutor,
              subjectId,
            })
          }
          onBack={() => setBookingState({ step: 'subject', student: bookingState.student })}
        />
      );
    }
    case 'date':
      return renderStep(
        'date',
        <main className='mx-auto max-w-3xl space-y-6 p-6'>
          <PickDate
            subject={{
              id: bookingState.subjectId,
              slug: bookingState.selection.subject.slug,
              name: bookingState.selection.subject.name,
            }}
            tutor={{ id: bookingState.tutor.id, name: bookingState.tutor.name }}
            todayStartMs={todayStartMs}
            onBackAction={() =>
              setBookingState({ step: 'tutor', student: bookingState.student, selection: bookingState.selection })
            }
            onConfirmAction={session => {
              const requiredMinutes = getSessionDurationMinutes(session);
              const reservation: Reservation = {
                student: bookingState.student,
                subject: {
                  id: bookingState.subjectId,
                  slug: bookingState.selection.subject.slug,
                  name: bookingState.selection.subject.name,
                },
                tutor: bookingState.tutor,
                session,
              };

              if (shouldBlockForCredits(balance.available_minutes, requiredMinutes)) {
                setBookingState({ step: 'credits', reservation, selection: bookingState.selection });
                return;
              }

              void completeBooking(reservation).catch(error => {
                const message =
                  error instanceof Error ? error.message : 'Could not complete booking right now. Please try again.';
                setCheckoutError(message);
              });
            }}
          />
        </main>,
        checkoutError
      );
    case 'credits': {
      const creditsRequired = minutesToCredits(getSessionDurationMinutes(bookingState.reservation.session));
      return renderStep(
        'credits',
        <AddCredits
          submitButtonText='Buy credits and book session'
          showSuccessCard={false}
          onBackAction={() =>
            setBookingState({
              step: 'date',
              student: bookingState.reservation.student,
              selection: bookingState.selection,
              tutor: bookingState.reservation.tutor,
              subjectId: bookingState.reservation.subject.id,
            })
          }
          onPurchaseCompleteAction={async purchase => {
            let purchaseResult: {
              balance: CreditBalance;
              warning?: string;
            } | null = null;

            try {
              purchaseResult = await purchaseParentCredits(parentId, purchase.pkg.credits, balance);
              setBalance(purchaseResult.balance);
              await completeBooking(bookingState.reservation, purchase, purchaseResult.warning);
            } catch {
              setCheckoutError(
                purchaseResult
                  ? 'Credits were added, but the reservation could not be completed. Please choose a new time and try again.'
                  : 'Could not complete the credit purchase right now. Please try again.'
              );
              setBookingState({
                step: 'date',
                student: bookingState.reservation.student,
                selection: bookingState.selection,
                tutor: bookingState.reservation.tutor,
                subjectId: bookingState.reservation.subject.id,
              });
            }
          }}
        >
          <Card>
            <CardContent className='pt-6 text-sm text-muted-foreground space-y-1'>
              <p className='font-semibold text-foreground'>Pending reservation</p>
              <p>Student: {bookingState.reservation.student.name}</p>
              <p>When: {formatSessionDateTime(new Date(bookingState.reservation.session.scheduled_at))}</p>
              <p>Subject: {bookingState.reservation.subject.name}</p>
              <p>Tutor: {bookingState.reservation.tutor.name}</p>
              <p>
                Credits required: {creditsRequired} {creditsRequired === 1 ? 'credit' : 'credits'}
              </p>
            </CardContent>
          </Card>
        </AddCredits>,
        checkoutError
      );
    }
    case 'success': {
      const wasPurchased = Boolean(bookingState.purchase);
      const reservedCredits = minutesToCredits(
        slotUnitsToMinutes(getSessionSlotUnits(bookingState.reservation.session))
      );
      return (
        <>
          {lowCreditsToast}
          <SuccessCard
            title={wasPurchased ? 'Purchase and reservation complete' : 'Reservation complete'}
            buttonLabel='View Sessions'
            href='/dashboard/sessions'
          >
            <p className='text-muted-foreground'>
              {wasPurchased
                ? `Your credits purchase and session reservation both succeeded. We reserved ${reservedCredits} ${reservedCredits === 1 ? 'credit' : 'credits'} for this booking.`
                : `Your session reservation succeeded and ${reservedCredits} ${reservedCredits === 1 ? 'credit is' : 'credits are'} now reserved for this booking.`}
            </p>
            {bookingState.warning ? (
              <p className='w-full rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800'>
                {bookingState.warning}
              </p>
            ) : null}
            <BookingSuccessDetails
              reservation={bookingState.reservation}
              confirmationCode={bookingState.confirmationCode}
              purchasedCredits={bookingState.purchase?.pkg.credits}
            />
          </SuccessCard>
        </>
      );
    }
  }
}
