// Metro config for the pnpm monorepo (Expo SDK 54).
// Watch the workspace root and resolve from both node_modules so the
// `@triaji/shared` workspace package resolves. Package exports are enabled by
// default in SDK 54, and node-linker=hoisted gives a flat layout, so no other
// resolver workarounds are needed.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
