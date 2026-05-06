'use client';

import { createContext, ReactNode, useContext, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table';

interface DataTableContextValue {
  globalFilter: string;
  setColumnFilter: (columnId: string, value: string | undefined) => void;
  setGlobalFilter: (value: string) => void;
}

const DataTableContext = createContext<DataTableContextValue | null>(null);

function useDataTableContext(componentName: string) {
  const context = useContext(DataTableContext);

  if (!context) {
    throw new Error(`${componentName} must be used within DataTable.`);
  }

  return context;
}

interface DataTableFilterOption<TValue extends string = string> {
  label: string;
  value: TValue;
}

type DataTableFilterInputOption<TValue extends string = string> = TValue | DataTableFilterOption<TValue>;

interface DataTableFilterProps<TValue extends string = string> {
  columnId: string;
  label: string;
  options: DataTableFilterInputOption<TValue>[];
  allOptionLabel?: string;
  allOptionValue?: string;
  triggerClassName?: string;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchColumns?: string[]; // accepts an array so we can do ['name', 'email']
  children?: ReactNode;
}

interface DataTableToolbarProps {
  children?: ReactNode;
}

interface DataTableSearchProps {
  placeholder?: string;
}

export function DataTableToolbar({ children }: DataTableToolbarProps) {
  return <>{children}</>;
}

function DataTableToolbarContainer({ children }: DataTableToolbarProps) {
  return <div className='flex items-center py-4 sm:justify-end'>{children}</div>;
}

export function DataTableSearch({ placeholder = 'Search' }: DataTableSearchProps) {
  const { globalFilter, setGlobalFilter } = useDataTableContext('DataTable.Search');
  return (
    <Input
      placeholder={placeholder}
      value={globalFilter}
      onChange={event => setGlobalFilter(event.target.value)}
      className='w-full sm:w-auto sm:max-w-sm bg-sidebar'
    />
  );
}

function normalizeFilterOption<TValue extends string>(option: DataTableFilterInputOption<TValue>) {
  if (typeof option === 'string') {
    return { label: option, value: option };
  }

  return option;
}

export function DataTableFilter<TValue extends string = string>({
  columnId,
  label,
  options,
  allOptionLabel = 'All',
  allOptionValue = '__all__',
}: DataTableFilterProps<TValue>) {
  const { setColumnFilter } = useDataTableContext('DataTable.Filter');

  return (
    <Select onValueChange={value => setColumnFilter(columnId, value === allOptionValue ? undefined : value)}>
      <SelectTrigger className='mr-2 w-auto bg-sidebar'>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={allOptionValue}>{allOptionLabel}</SelectItem>
        {options.map(rawOption => {
          const option = normalizeFilterOption(rawOption);

          return (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function DataTableRoot<TData, TValue>({ columns, data, searchColumns, children }: DataTableProps<TData, TValue>) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  // TODO: "const effectiveSearchColumns = searchColumns ?? [];" in case name is not in column of future tables
  const effectiveSearchColumns = searchColumns?.length ? searchColumns : ['name'];
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    getColumnCanGlobalFilter: column => effectiveSearchColumns.includes(column.id),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      columnFilters,
      globalFilter,
    },
  });

  return (
    <DataTableContext.Provider
      value={{
        globalFilter,
        setColumnFilter: (columnId, value) => table.getColumn(columnId)?.setFilterValue(value),
        setGlobalFilter: value => table.setGlobalFilter(value),
      }}
    >
      <div>
        <DataTableToolbarContainer>
          {children}
          {/* Can remove DataTableSearch to make it optional */}
          <DataTableSearch />
        </DataTableToolbarContainer>
        <div className='overflow-hidden rounded-md border border-zinc-400'>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map(header => {
                    return (
                      <TableHead
                        key={header.id}
                        className='px-4 py-2 text-left  font-semibold tracking-wider bg-stone-300 border border-b-zinc-400'
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map(row => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'} className='bg-sidebar'>
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className='h-24 text-center bg-sidebar'>
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DataTableContext.Provider>
  );
}

type DataTableComponent = typeof DataTableRoot & {
  Toolbar: typeof DataTableToolbar;
  Search: typeof DataTableSearch;
  Filter: typeof DataTableFilter;
};

export const DataTable = Object.assign(DataTableRoot, {
  Toolbar: DataTableToolbar,
  Search: DataTableSearch,
  Filter: DataTableFilter,
}) as DataTableComponent;
