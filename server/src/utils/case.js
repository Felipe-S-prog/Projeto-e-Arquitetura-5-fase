// O MySQL costuma usar snake_case (class_id) e o front-end já usa camelCase (classId).
// Os models usam estas funções para converter a linha do banco no objeto da API.
export function toCamelCase(row) {
  if (row === null || typeof row !== 'object' || Array.isArray(row) || row instanceof Date) return row;
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase()), value])
  );
}

export function toCamelCaseList(rows) {
  return rows.map(toCamelCase);
}
