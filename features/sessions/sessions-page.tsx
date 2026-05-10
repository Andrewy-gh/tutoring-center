import Link from 'next/link';
import { DataTable, DataTableToolbar } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getUserRole } from '@/lib/auth';
import { sessionDataService } from './sessions-service';
import { columns } from './sessions-table';

function parseSessionKind(kind: string | undefined) {
  switch (kind) {
    case 'all':
    case 'upcoming':
    case 'past':
      return kind;
    default:
      return undefined;
  }
}

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const role = await getUserRole();
  const params = await searchParams;
  const kind = parseSessionKind(params.kind);
  const sessions = await sessionDataService.getSessions(kind);

  const description = role === 'admin' ? 'All scheduled sessions' : 'Your scheduled sessions';

  return (
    <main className='p-2 md:p-8'>
      <div className='flex flex-col gap-4'>
        <div className='flex items-center justify-between'>
          <div>
            <div className='flex items-center gap-2'>
              <h1 className='font-serif text-3xl text-primary'>Sessions</h1>
              <Badge variant='secondary'>{sessions.length}</Badge>
            </div>
            <p className='text-muted-foreground mt-1 text-sm'>{description}</p>
          </div>
          {role === 'parent' && (
            <Button asChild>
              <Link href='/dashboard/sessions/new'>New Session</Link>
            </Button>
          )}
        </div>

        <DataTable columns={columns} data={sessions}>
          <DataTableToolbar>
            <div className='mr-auto flex gap-2'>
              <Button
                variant={!kind || kind === 'all' ? 'default' : 'outline'}
                size='sm'
                className={!kind || kind === 'all' ? undefined : 'border-zinc-400 bg-transparent'}
                asChild
              >
                <Link href='/dashboard/sessions?kind=all'>All Sessions</Link>
              </Button>
              <Button
                variant={kind === 'upcoming' ? 'default' : 'outline'}
                size='sm'
                className={kind === 'upcoming' ? undefined : 'border-zinc-400 bg-transparent'}
                asChild
              >
                <Link href='/dashboard/sessions?kind=upcoming'>Upcoming</Link>
              </Button>
              <Button
                variant={kind === 'past' ? 'default' : 'outline'}
                size='sm'
                className={kind === 'past' ? undefined : 'border-zinc-400 bg-transparent'}
                asChild
              >
                <Link href='/dashboard/sessions?kind=past'>Past</Link>
              </Button>
            </div>
          </DataTableToolbar>
        </DataTable>
      </div>
    </main>
  );
}
