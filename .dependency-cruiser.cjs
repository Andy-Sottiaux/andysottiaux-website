/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular-dependencies',
      severity: 'error',
      comment: 'Circular imports make the bento/camera code hard to change safely.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'api-routes-do-not-import-ui',
      severity: 'error',
      comment: 'Route handlers should stay server-only and must not pull client UI into the bundle.',
      from: { path: '^app/api/' },
      to: { path: '^components/' },
    },
    {
      name: 'ui-does-not-import-api-routes',
      severity: 'error',
      comment: 'Client UI should call same-origin endpoints, not import route-handler modules.',
      from: { path: '^components/' },
      to: { path: '^app/api/' },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    includeOnly: '^(app|components|lib)',
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      conditionNames: ['import', 'require', 'node', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'],
    },
  },
}
