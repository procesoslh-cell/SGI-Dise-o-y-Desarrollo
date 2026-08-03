export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function requireBody(fields, body) {
  for (const field of fields) {
    const value = body?.[field];
    if (value === undefined || value === null || String(value).trim() === '') {
      throw new Error(`Campo obligatorio: ${field}`);
    }
  }
}
