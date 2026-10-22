import { describe, expect, test } from 'vitest';
import { Decimal, type Billing, type Context } from '@stripe/extensibility-sdk';

import SkipCreatingPartialPeriodProrationItem, {
  type SkipCreatingPartialPeriodProrationItemConfig,
} from './index.js';

const context: Context = {
  type: 'script',
  id: 'script_test123',
  livemode: false,
  stripeContext: 'acct_test123',
  clockTime: '2024-01-01T00:00:00Z',
};

const config: SkipCreatingPartialPeriodProrationItemConfig = {
  metadataKey: 'suppress_prorations',
  metadataValue: 'true',
};

function makePriceItem(
  key: string,
  options: {
    isProration?: boolean;
    productMetadata?: Record<string, string>;
    priceMetadata?: Record<string, string>;
    prorationFactor?: string;
    type?: 'credit' | 'debit';
  } = {}
): Billing.RecurringBillingItemHandling.Item {
  return {
    key,
    type: options.type ?? 'debit',
    isProration: options.isProration ?? false,
    servicePeriod: {
      value: 'timeRange',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-02-01'),
    },
    prorationFactor: Decimal.from(options.prorationFactor ?? '1'),
    priceKind: 'price',
    price: {
      id: 'price_test',
      metadata: options.priceMetadata ?? {},
      product: {
        id: 'prod_test',
        name: 'Test product',
        metadata: options.productMetadata ?? {},
      },
      recurring: {
        interval: 'month',
        intervalCount: 1,
        usageType: 'licensed',
      },
      billingScheme: 'per_unit',
      tiers: [],
      type: 'recurring',
      currency: 'usd',
    },
  };
}

function makeRateCardItem(key: string): Billing.RecurringBillingItemHandling.Item {
  return {
    key,
    type: 'debit',
    isProration: true,
    servicePeriod: {
      value: 'timeRange',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-02-01'),
    },
    prorationFactor: Decimal.from(0.5),
    priceKind: 'rateCardRate',
    rateCardRate: {
      id: 'rcr_test',
      metadata: { suppress_prorations: 'true' },
      rateCard: { id: 'rc_test', currency: 'usd' },
      tieringMode: 'graduated',
      tiers: [],
    },
  };
}

const script = new SkipCreatingPartialPeriodProrationItem();

describe('SkipCreatingPartialPeriodProrationItem', () => {
  test('suppresses only partial-period prorations with matching product metadata', () => {
    const input: Billing.RecurringBillingItemHandling.BeforeItemCreationInput = {
      items: [
        makePriceItem('matching_credit', {
          type: 'credit',
          isProration: true,
          prorationFactor: '-0.5',
          productMetadata: { suppress_prorations: 'true' },
        }),
        makePriceItem('matching_debit', {
          isProration: true,
          prorationFactor: '0.5',
          productMetadata: { suppress_prorations: 'true' },
        }),
        makePriceItem('regular_charge', {
          productMetadata: { suppress_prorations: 'true' },
        }),
        makePriceItem('different_value', {
          isProration: true,
          prorationFactor: '0.5',
          productMetadata: { suppress_prorations: 'false' },
        }),
        makePriceItem('missing_key', {
          isProration: true,
          prorationFactor: '0.5',
          productMetadata: { other_key: 'true' },
        }),
        makePriceItem('price_metadata_only', {
          isProration: true,
          prorationFactor: '0.5',
          priceMetadata: { suppress_prorations: 'true' },
        }),
        makeRateCardItem('other_price_kind'),
      ],
    };

    expect(script.beforeItemCreation(input, config, context)).toEqual({
      items: [
        { key: 'matching_credit', creationStrategy: 'doNotCreate' },
        { key: 'matching_debit', creationStrategy: 'doNotCreate' },
        { key: 'regular_charge', creationStrategy: 'invoice' },
        { key: 'different_value', creationStrategy: 'invoice' },
        { key: 'missing_key', creationStrategy: 'invoice' },
        { key: 'price_metadata_only', creationStrategy: 'invoice' },
        { key: 'other_price_kind', creationStrategy: 'invoice' },
      ],
    });
  });

  test('retains full-period items even when they are marked as prorations', () => {
    const items = [
      makePriceItem('full_debit', {
        isProration: true,
        prorationFactor: '1.0',
        productMetadata: { suppress_prorations: 'true' },
      }),
      makePriceItem('full_credit', {
        type: 'credit',
        isProration: true,
        prorationFactor: '-1.0',
        productMetadata: { suppress_prorations: 'true' },
      }),
      makePriceItem('zero_factor', {
        isProration: true,
        prorationFactor: '0',
        productMetadata: { suppress_prorations: 'true' },
      }),
    ];

    expect(script.beforeItemCreation({ items }, config, context)).toEqual({
      items: [
        { key: 'full_debit', creationStrategy: 'invoice' },
        { key: 'full_credit', creationStrategy: 'invoice' },
        { key: 'zero_factor', creationStrategy: 'invoice' },
      ],
    });
  });

  test('suppresses a fractional factor above one but retains a whole-number factor', () => {
    const items = [
      makePriceItem('fractional_above_one', {
        isProration: true,
        prorationFactor: '2.5',
        productMetadata: { suppress_prorations: 'true' },
      }),
      makePriceItem('whole_number_above_one', {
        isProration: true,
        prorationFactor: '2.0',
        productMetadata: { suppress_prorations: 'true' },
      }),
    ];

    expect(script.beforeItemCreation({ items }, config, context)).toEqual({
      items: [
        { key: 'fractional_above_one', creationStrategy: 'doNotCreate' },
        { key: 'whole_number_above_one', creationStrategy: 'invoice' },
      ],
    });
  });

  test('trims and compares metadata values without regard to case', () => {
    const input: Billing.RecurringBillingItemHandling.BeforeItemCreationInput = {
      items: [
        makePriceItem('matching', {
          isProration: true,
          prorationFactor: '0.5',
          productMetadata: { suppress_prorations: ' TRUE ' },
        }),
      ],
    };

    expect(script.beforeItemCreation(input, config, context)).toEqual({
      items: [{ key: 'matching', creationStrategy: 'doNotCreate' }],
    });
  });

  test.each(['invoiceItem', 'invoiceLineItems'] as const)(
    'skips credits associated through %s with a skipped debit in either input order',
    (association) => {
      const debit = makePriceItem('skipped_debit', {
        isProration: true,
        prorationFactor: '0.5',
        productMetadata: { suppress_prorations: 'true' },
      });
      // These credits do not independently match the suppression rule.
      const fullCredit: Billing.RecurringBillingItemHandling.Item = {
        ...makePriceItem('full_credit', {
          type: 'credit',
          isProration: true,
          prorationFactor: '-1',
        }),
        ...(association === 'invoiceItem'
          ? { creditedItems: 'invoiceItem', invoiceItem: { id: debit.key } }
          : {
              creditedItems: 'invoiceLineItems',
              invoiceLineItems: {
                invoice: { id: 'in_test' },
                invoiceLineItems: [{ id: 'historical_debit' }, { id: debit.key }],
              },
            }),
      };
      const partialCredit = {
        ...fullCredit,
        key: 'partial_credit',
        prorationFactor: Decimal.from('-0.25'),
      };

      for (const items of [
        [fullCredit, partialCredit, debit],
        [debit, partialCredit, fullCredit],
      ]) {
        expect(script.beforeItemCreation({ items }, config, context)).toEqual({
          items: items.map((item) => ({
            key: item.key,
            creationStrategy: 'doNotCreate',
          })),
        });
      }
    }
  );

  test('retains credits for retained or historical debits and unknown associations', () => {
    const items: Billing.RecurringBillingItemHandling.Item[] = [
      makePriceItem('skipped_debit', {
        isProration: true,
        prorationFactor: '0.5',
        productMetadata: { suppress_prorations: 'true' },
      }),
      makePriceItem('retained_debit'),
      {
        ...makePriceItem('retained_debit_credit', { type: 'credit' }),
        creditedItems: 'invoiceItem',
        invoiceItem: { id: 'retained_debit' },
      },
      {
        ...makePriceItem('historical_credit', { type: 'credit' }),
        creditedItems: 'invoiceItem',
        invoiceItem: { id: 'ii_historical' },
      },
      {
        ...makePriceItem('retained_lines_credit', { type: 'credit' }),
        creditedItems: 'invoiceLineItems',
        invoiceLineItems: {
          invoice: { id: 'skipped_debit' },
          invoiceLineItems: [{ id: 'retained_debit' }, { id: 'il_historical' }],
        },
      },
      {
        ...makePriceItem('empty_lines_credit', { type: 'credit' }),
        creditedItems: 'invoiceLineItems',
        invoiceLineItems: { invoice: { id: 'in_test' }, invoiceLineItems: [] },
      },
      {
        ...makePriceItem('other_credit', { type: 'credit' }),
        creditedItems: 'other',
        otherCreditedItems: 'skipped_debit',
      },
      makePriceItem('unassociated_credit', { type: 'credit' }),
    ];

    expect(script.beforeItemCreation({ items }, config, context)).toEqual({
      items: items.map((item) => ({
        key: item.key,
        creationStrategy: item.key === 'skipped_debit' ? 'doNotCreate' : 'invoice',
      })),
    });
  });

  test('returns no creation strategies when there are no items', () => {
    expect(script.beforeItemCreation({ items: [] }, config, context)).toEqual({
      items: [],
    });
  });

  test('passes every created item through to invoicing', () => {
    const input: Billing.RecurringBillingItemHandling.FilterItemsInput = {
      items: [makePriceItem('first'), makeRateCardItem('second')],
    };

    expect(script.filterItems(input, config, context)).toEqual({
      items: [{ key: 'first' }, { key: 'second' }],
    });
  });

  test('places all invoice items in one group that sets latest_invoice', () => {
    const input: Billing.RecurringBillingItemHandling.GroupItemsInput = {
      items: [makePriceItem('first'), makeRateCardItem('second')],
    };

    expect(script.groupItems(input, config, context)).toEqual({
      groups: [
        {
          items: [{ key: 'first' }, { key: 'second' }],
          setsLatestInvoice: true,
        },
      ],
    });
  });

  test('returns no invoice groups when there are no items', () => {
    expect(script.groupItems({ items: [] }, config, context)).toEqual({
      groups: [],
    });
  });
});
