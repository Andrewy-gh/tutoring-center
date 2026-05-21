import { notFound } from 'next/navigation';
import { getNewSessionBookingData } from '@/features/booking/booking-data';
import { BookingScreen } from '@/features/booking/booking-screen';
import { getUserRole } from '@/lib/auth';

export default async function NewSessionPage() {
  const role = await getUserRole();

  if (role !== 'parent') {
    notFound();
  }

  const bookingData = await getNewSessionBookingData(role);

  return (
    <main className='p-2 md:p-8'>
      <BookingScreen
        parentId={bookingData.parentId}
        initialBalance={bookingData.initialBalance}
        students={bookingData.students}
        subjects={bookingData.subjects}
        tutors={bookingData.tutors}
        todayStartMs={bookingData.todayStartMs}
      />
    </main>
  );
}
