# Stripe Billing Extensions

A collection of [Stripe Billing](https://stripe.com/billing) extensions that customize billing behavior for subscriptions. Each extension implements a `BillingScript` interface and is registered in the app manifest (`stripe-app.yaml`).

## Repository Structure

```
billing-extensions/
├── extensions/                 # One package per extension (pnpm workspace)
│   └── <extension_id>/
│       ├── src/index.ts        # Extension implementation
│       ├── src/index.test.ts   # Tests
│       ├── config_schema.json  # Configuration schema
│       ├── package.json
│       ├── tsconfig.json
│       └── vitest.config.mts
├── stripe-app.yaml             # App manifest — extension registration
├── package.json                # Workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json          # Shared TypeScript config
├── eslint.config.mts
├── .prettierrc, .prettierignore
└── vitest.config.base.mts
```

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm 10

### Install Dependencies

```bash
pnpm install
```

### Build

```bash
pnpm build
```

### Lint

```bash
pnpm lint
```

### Test

```bash
pnpm test
```

### Run All Checks

```bash
pnpm check
```

## License

Apache-2.0 — see [LICENSE](LICENSE).
