// Metro config for the pnpm monorepo.
// Without this, Metro can't watch the workspace root or resolve the
// `@triaji/shared` workspace package (which is exports-only), so bundling fails
// with "Unable to resolve module @triaji/shared/i18n".
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so changes in packages/* are picked up.
config.watchFolders = [workspaceRoot];

// Resolve modules from the app first, then the workspace root (pnpm hoists here).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// @triaji/shared uses the "exports" field (e.g. "./i18n"), so Metro must honor it.
config.resolver.unstable_enablePackageExports = true;
// Pin the export conditions so Metro never resolves the "types" condition
// (which would send `react` to @types/react). Runtime conditions only.
config.resolver.unstable_conditionNames = ['react-native', 'require', 'default'];

// @types/* are compile-time only; never let the bundler resolve into them
// (under pnpm, resolving `react` was landing on @types/react).
config.resolver.blockList = [/[/\\]node_modules[/\\]@types[/\\].*/];

module.exports = config;
