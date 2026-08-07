# Stripe Billing Extensions

This repository contains the out-of-the-box [Billing Extensions](https://docs.stripe.com/billing/scripts) available as a first-party app on Stripe. Each extension implements an extension interface and runs as part of a [Stripe App](https://docs.stripe.com/stripe-apps).

Use these extensions to override default billing logic — control how prorations are calculated, route items to separate invoices, or set custom rules for customer balance application.

## Documentation

- [Billing Extensions overview](https://docs.stripe.com/billing/scripts) — learn what billing extensions are and how they work.
- [Stripe-authored extensions](https://docs.stripe.com/billing/scripts/stripe-authored) — details on the extensions included in this repository.
- [Author your own](https://docs.stripe.com/billing/scripts/author-your-own) — build custom extensions and upload them to your account via Stripe Apps.

## Available extensions

| Extension                             | Interface                                 | Description                                                                                                                  |
| ------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `prorate_by_custom_interval`          | `billing.prorations`                      | Round proration calculations to a custom time interval (hour, day, week, or month) instead of prorating to the exact second. |
| `credit_and_debit_full_product_price` | `billing.prorations`                      | Charge or refund the full product price instead of the prorated amount for products with specific metadata.                  |
| `separate_invoice_for_metered_items`  | `billing.recurring_billing_item_handling` | Route metered and licensed subscription items to separate invoices.                                                          |
| `minimum_amount_before_collection`    | `billing.customer_balance_application`    | Defer invoice collection until the total owed exceeds a configured minimum amount.                                           |
| `maximum_credit_amount_per_invoice`   | `billing.customer_balance_application`    | Cap the credit amount applied from a customer's balance to a single invoice.                                                 |

## Getting started

### Prerequisites

- Node.js >= 20
- [pnpm](https://pnpm.io/) 10

### Installation

```bash
pnpm install
```

### Build

```bash
pnpm build
```

### Run tests

```bash
pnpm test
```

### Lint

```bash
pnpm lint
```

### Run all checks

Build, lint, and test in one command:

```bash
pnpm check
```

## Project structure

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
└── vitest.config.base.mts
```

Each extension is a self-contained pnpm workspace package under `extensions/`. The `stripe-app.yaml` manifest registers all extensions and points to their configuration schemas and entry points.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and how to submit changes.

## License

MIT — see [LICENSE](LICENSE).
