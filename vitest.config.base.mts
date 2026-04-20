import { defineConfig } from 'vitest/config';
import { existsSync, readdirSync } from 'fs';

const extensionProjects = existsSync('extensions')
  ? readdirSync('extensions')
      .filter((name) => existsSync(`extensions/${name}/package.json`))
      .map((name) => `extensions/${name}`)
  : [];

const coProjects = existsSync('custom-objects/package.json') ? ['custom-objects'] : [];

const projects = [...extensionProjects, ...coProjects];

export default projects.length > 0
  ? defineConfig({
      test: {
        projects,
        passWithNoTests: true,

        // Only run tests from src, not compiled dist
        exclude: ['**/node_modules', '**/dist'],
        // Place snapshots alongside test files instead of in __snapshots__
        snapshotFormat: {
          escapeString: false,
          printBasicPrototype: false,
        },
        resolveSnapshotPath: (testPath, snapExtension) => {
          return testPath.replace(/\.test\.ts$/, `.test${snapExtension}`);
        },
      },
    })
  : defineConfig({ test: { passWithNoTests: true, include: [] } });
