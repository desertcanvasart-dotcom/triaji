# Building @triaji/web

From the repository root, use Node 22 and run:

```sh
pnpm install --frozen-lockfile
pnpm --filter @triaji/web build
```

The root `.npmrc` uses isolated dependencies. Do not override it with
`node-linker=hoisted`: the mixed Expo/Next.js React versions caused Next.js
error-page prerendering to fail with a null `useContext` dispatcher.

Railway waits for successful GitHub CI before deploying. A skipped deployment
with `CI check suite failed` keeps the previous release live.
