export const validMenuPaths = [
  '/', '/quotations', '/financial-report', '/task-board', '/settlement', '/knowledge',
  '/factories', '/agent-quotes', '/requirements', '/clients', '/timeline', '/as-requests',
];

export const normalizeMenuPaths = (paths) => {
  if (!Array.isArray(paths)) return [];
  return [...new Set(paths.filter((path) => validMenuPaths.includes(path)))];
};