'use client';

import Link from 'next/link';
import { DataTable, DataTableFilter, DataTableToolbar } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatSignedCredits } from '@/features/credits';
import type { UserRole } from '@/lib/auth';
import { formatHours, minutesToHours } from '@/lib/billing-units';
import type { CreditTransactionRow } from '@/lib/data/credit-transactions';
import {
  formatTransactionTypeLabel,
  TRANSACTION_TYPE_FILTER_OPTIONS,
  type TransactionType,
} from '@/lib/validators/transactions';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';

function getTypeBadgeVariant(type: TransactionType) {
  switch (type) {
    case 'purchase':
      return 'default';
    case 'session_debit':
    case 'cancellation_fee':
      return 'destructive';
    case 'refund':
      return 'outline';
    case 'adjustment':
      return 'secondary';
    case 'reservation':
      return 'secondary';
    case 'reservation_release':
      return 'outline';
    default:
      return 'secondary';
  }
}

export function getColumns(role: UserRole) {
  const columns: ColumnDef<CreditTransactionRow>[] = [
    {
      id: 'date',
      accessorKey: 'created_at',
      header: () => <div>Date</div>,
      cell: ({ row }) => <div>{format(new Date(row.original.created_at), 'MMM d, yyyy')}</div>,
    },
    {
      id: 'name',
      accessorKey: 'student_name',
      header: () => <div>Student</div>,
      cell: ({ row }) => <div>{row.original.student_name}</div>,
    },
    {
      id: 'type',
      accessorKey: 'type',
      header: () => <div>Type</div>,
      cell: ({ row }) => (
        <Badge variant={getTypeBadgeVariant(row.original.type)}>{formatTransactionTypeLabel(row.original.type)}</Badge>
      ),
    },
    {
      id: 'net_amount',
      accessorKey: 'net_amount',
      header: () => <div>Net</div>,
      cell: ({ row }) => {
        const amount = row.original.net_amount;
        const isPositive = amount >= 0;
        return <span className={isPositive ? 'text-green-600' : 'text-red-600'}>{formatSignedCredits(amount)}</span>;
      },
    },
    {
      id: 'available_delta_minutes',
      accessorKey: 'available_delta_minutes',
      header: () => <div>Available Delta</div>,
      cell: ({ row }) => <div>{formatSignedCredits(row.original.available_delta_minutes)}</div>,
    },
    {
      id: 'pending_delta_minutes',
      accessorKey: 'pending_delta_minutes',
      header: () => <div>Pending Delta</div>,
      cell: ({ row }) => <div>{formatSignedCredits(row.original.pending_delta_minutes)}</div>,
    },
    {
      id: 'available_after_minutes',
      accessorKey: 'available_after_minutes',
      header: () => <div>Available After</div>,
      cell: ({ row }) => <div>{formatHours(minutesToHours(row.original.available_after_minutes))}</div>,
    },
    {
      id: 'pending_after_minutes',
      accessorKey: 'pending_after_minutes',
      header: () => <div>Pending After</div>,
      cell: ({ row }) => <div>{formatHours(minutesToHours(row.original.pending_after_minutes))}</div>,
    },
    {
      id: 'actions',
      header: () => <div>Actions</div>,
      cell: ({ row }) => (
        <Button asChild variant='default' size='sm'>
          <Link href={`/dashboard/credit-transactions/${row.original.id}`}>Details</Link>
        </Button>
      ),
    },
  ];

  if (role === 'admin') {
    columns.splice(1, 0, {
      id: 'parent',
      accessorKey: 'parent_name',
      header: () => <div>Parent</div>,
      cell: ({ row }) => <div>{row.original.parent_name}</div>,
    });
  }

  return columns;
}

export function CreditTransactionsTable({ role, data }: { role: UserRole; data: CreditTransactionRow[] }) {
  const searchColumns = role === 'admin' ? ['parent', 'student'] : ['student'];

  return (
    <DataTable columns={getColumns(role)} data={data} searchColumns={searchColumns}>
      <DataTableToolbar>
        <DataTableFilter columnId='type' label='Filter by type' options={TRANSACTION_TYPE_FILTER_OPTIONS} />
      </DataTableToolbar>
    </DataTable>
  );
}
