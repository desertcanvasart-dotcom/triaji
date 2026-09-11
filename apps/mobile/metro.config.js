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

// Force a SINGLE copy of React / React Native. Some deps (react-redux,
// @reduxjs/toolkit) ship a nested react@19.3.x that Metro would otherwise
// bundle alongside the app's react@19.1.0, giving two React instances and a
// "Cannot read property 'useRef' of null" render error. Resolve these from the
// project root so every module shares one React.
const SINGLETONS = ['react', 'react-dom', 'react-native', 'scheduler'];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const top = moduleName.startsWith('react/')
    ? 'react'
    : moduleName.startsWith('react-native/')
      ? 'react-native'
      : moduleName;
  if (SINGLETONS.includes(top)) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(projectRoot, 'index.js') },
      moduleName,
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
