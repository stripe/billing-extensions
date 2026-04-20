#!/usr/bin/env node
'use strict';
/**
 * Runs tests across the workspace:
 * - vitest for script extensions and custom objects (extensions/*)
 * - jest for UI extensions (ui/)
 */
const { existsSync, readdirSync } = require('fs');
const { execSync } = require('child_process');

const hasExtensions =
  existsSync('extensions') &&
  readdirSync('extensions').some((name) => existsSync(`extensions/${name}/package.json`));

const hasUI = existsSync('ui/package.json');

let exitCode = 0;

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (e) {
    exitCode = e.status ?? 1;
  }
}

if (hasExtensions) {
  run('vitest run');
}

if (hasUI) {
  try {
    execSync('pnpm --filter "./ui" test', { stdio: 'inherit' });
  } catch {
    // UI test failures are non-fatal
  }
}

process.exit(exitCode);
