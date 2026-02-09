import type { Context } from 'hono';

export function success(c: Context, data: unknown = null, message = 'Success', status = 200) {
  return c.json({ success: true, message, data }, status);
}

export function created(c: Context, data: unknown = null, message = 'Created successfully') {
  return success(c, data, message, 201);
}

export function updated(c: Context, data: unknown = null, message = 'Updated successfully') {
  return success(c, data, message, 200);
}

export function deleted(c: Context, message = 'Deleted successfully') {
  return success(c, null, message, 200);
}

export function error(c: Context, message = 'Internal Server Error', status = 500, errors?: unknown) {
  const body: Record<string, unknown> = {
    success: false,
    message,
    error: message
  };
  if (errors) {
    body.errors = Array.isArray(errors) ? errors : [errors];
  }
  return c.json(body, status);
}

export function validationError(c: Context, errors: unknown) {
  return error(c, 'Validation failed', 400, errors);
}

export function notFound(c: Context, resource = 'Resource') {
  return error(c, `${resource} not found`, 404);
}

export function unauthorized(c: Context, message = 'Unauthorized access') {
  return error(c, message, 401);
}

export function forbidden(c: Context, message = 'Forbidden access') {
  return error(c, message, 403);
}

export function handleDbResult(c: Context, result: { changes: number; lastInsertRowid: number | null } | null, operation: 'create' | 'update' | 'delete', resource = 'Resource') {
  if (!result) return notFound(c, resource);
  switch (operation) {
    case 'create':
      return created(c, { id: result.lastInsertRowid }, `${resource} created successfully`);
    case 'update':
      if (result.changes === 0) return notFound(c, resource);
      return updated(c, null, `${resource} updated successfully`);
    case 'delete':
      if (result.changes === 0) return notFound(c, resource);
      return deleted(c, `${resource} deleted successfully`);
    default:
      return success(c, result);
  }
}

export function handleQueryResult(c: Context, data: unknown, resource = 'Resource') {
  if (Array.isArray(data)) {
    return success(c, data, `${resource} retrieved successfully`);
  }
  if (data) {
    return success(c, data, `${resource} retrieved successfully`);
  }
  return notFound(c, resource);
}
