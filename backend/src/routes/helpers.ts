import type { Role, UserPayload } from '../types';

export const parseJson = <T>(value: any, fallback: T): T => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const parseCsv = (csv: string): string[][] => {
  const rows: string[][] = [];
  let current: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    if (char === '"') {
      if (inQuotes && csv[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      current.push(value.trim());
      value = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (value.length || current.length) {
        current.push(value.trim());
        rows.push(current);
        current = [];
        value = '';
      }
    } else {
      value += char;
    }
  }

  if (value.length || current.length) {
    current.push(value.trim());
    rows.push(current);
  }

  return rows.filter((row) => row.some((cell) => cell.length));
};

export const toCsv = (rows: string[][]): string => {
  const escape = (cell: string) => {
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  };
  return rows.map((row) => row.map((cell) => escape(cell)).join(',')).join('\n');
};

export const authGuard = (roles?: Role[]) => ({
  beforeHandle: async (ctx: any) => {
    const authHeader = ctx.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (!token) {
      ctx.set.status = 401;
      return { error: 'Unauthorized' };
    }

    const payload = await ctx.jwt.verify(token);
    if (!payload) {
      ctx.set.status = 401;
      return { error: 'Unauthorized' };
    }

    if (roles && !roles.includes(payload.role)) {
      ctx.set.status = 403;
      return { error: 'Forbidden' };
    }

    ctx.user = payload as UserPayload;
  }
});

export const now = () => new Date();
