import type { SortOrder } from 'mongoose';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

export function parseSortParam(
  sortParam: string | undefined,
  allowedFields: readonly string[],
  defaultSort: Record<string, SortOrder>,
): Record<string, SortOrder> {
  if (!sortParam || !sortParam.trim()) {
    return defaultSort;
  }

  const sort: Record<string, SortOrder> = {};
  const parts = sortParam.split(',').map((part) => part.trim()).filter(Boolean);

  for (const part of parts) {
    const isDesc = part.startsWith('-');
    const field = isDesc ? part.slice(1) : part;

    if (allowedFields.includes(field)) {
      sort[field] = isDesc ? -1 : 1;
    }
  }

  return Object.keys(sort).length > 0 ? sort : defaultSort;
}
