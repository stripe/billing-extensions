# Contributing to Stripe Billing Extensions

Thanks for your interest in contributing! This document explains how to set up a development environment, run checks, and submit changes.

## Getting started

1. Fork and clone the repository.
2. Install dependencies:

```bash
pnpm install
```

3. Make sure everything passes before making changes:

```bash
pnpm check
```

## Development workflow

Each extension lives in its own package under `extensions/`. The workspace is managed with [pnpm workspaces](https://pnpm.io/workspaces).

### Adding a new extension

1. From the repository root, run:

```bash
stripe generate extension <interface-name> <extension-name> script
```

This scaffolds `extensions/<extension-name>/` (with `package.json`, `tsconfig.json`, `tsconfig.build.json`, `eslint.config.mts`, and starter `src/index.ts` and `src/index.test.ts` files) and registers the extension in `stripe-app.yaml`.

2. Implement the interface and logic in `src/index.ts`.
3. Update the tests in `src/index.test.ts`.
4. Run `pnpm build` to generate `generated/config.schema.json` and `generated/config.ui.json` from your `Config` interface.

### Running tests

Run all tests:

```bash
pnpm test
```

Run tests for a specific extension:

```bash
pnpm --filter <extension_id> test
```

### Linting and formatting

This project uses ESLint and Prettier. Run both with:

```bash
pnpm lint
```

Auto-fix issues:

```bash
pnpm fix:lint
pnpm fix:format
```

A pre-commit hook (via [Husky](https://typicode.github.io/husky/) and lint-staged) runs linting and formatting on staged files automatically.

## Submitting a pull request

1. Create a feature branch from `main`.
2. Make your changes and add tests.
3. Run `pnpm check` to verify build, lint, and tests all pass.
4. Open a pull request against `main`.
5. Describe what the change does and why in the PR description.

## Reporting issues

If you find a bug or have a feature request, please [open an issue](../../issues). Include steps to reproduce the problem and the expected vs. actual behavior.

## Code of conduct

This project follows [Stripe's Developer Code of Conduct](https://stripe.com/legal/developer-code-of-conduct). By participating, you agree to uphold a welcoming and inclusive environment.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
