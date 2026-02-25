const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// monorepo: プロジェクトルートを明示的に設定（unstable_serverRootはmonorepoRootのまま）
config.projectRoot = projectRoot;

// monorepo全体を監視（サーバールートからの相対パスで解決されるため必須）
config.watchFolders = [
  monorepoRoot,
];

// モジュール解決: ローカル → ルートの順でnode_modulesを探索
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// pnpm hoistedモードではsymlink解決を無効にする
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
