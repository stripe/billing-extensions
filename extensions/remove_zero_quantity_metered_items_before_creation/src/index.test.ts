import { describe, expect, test } from 'vitest';
import { Decimal, type Billing, type Context } from '@stripe/extensibility-sdk';

import RemoveZeroQuantityMeteredItemsBeforeCreation, {
  type RemoveZeroQuantityMeteredItemsBeforeCreationConfig,
} from './index.js';

const context: Context = {
  type: 'script',
  id: 'script_test123',
  livemode: false,
  stripeContext: 'acct_test123',
  clockTime: '2024-01-01T00:00:00Z',
};

function makeItem(
  key: string,
  quantity: number,
  options: {
    productMetadata?: Record<string, string>;
    priceMetadata?: Record<string, string>;
    type?: 'credit' | 'debit';
    usageType?: 'licensed' | 'metered';
  } = {}
): Billing.RecurringBillingItemHandling.Item {
  return {
    key,
    type: options.type ?? 'debit',
    quantity: Decimal.from(quantity),
    isProration: false,
    servicePeriod: {
      value: 'timeRange',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-02-01'),
    },
    prorationFactor: Decimal.from(1),
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
        usageType: options.usageType ?? 'metered',
      },
      billingScheme: 'per_unit',
      tiers: [],
      type: 'recurring',
      currency: 'usd',
    },
  };
}

function makeRateCardItem(
  key: string,
  quantity: number
): Billing.RecurringBillingItemHandling.Item {
  return {
    key,
    type: 'debit',
    quantity: Decimal.from(quantity),
    isProration: false,
    servicePeriod: {
      value: 'timeRange',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-02-01'),
    },
    prorationFactor: Decimal.from(1),
    priceKind: 'rateCardRate',
    rateCardRate: {
      id: 'rcr_test',
      metadata: { billing_treatment: 'drop_zero' },
      rateCard: { id: 'rc_test', currency: 'usd' },
      tiers: [],
    },
  };
}

const script = new RemoveZeroQuantityMeteredItemsBeforeCreation();

describe('RemoveZeroQuantityMeteredItemsBeforeCreation', () => {
  test('drops only zero-quantity metered credits and debits when no metadata matcher is configured', () => {
    const items = [
      makeItem('zero_debit', 0),
      makeItem('zero_credit', 0, { type: 'credit' }),
      makeRateCardItem('zero_rate_card', 0),
      makeItem('zero_licensed_debit', 0, { usageType: 'licensed' }),
      makeItem('zero_licensed_credit', 0, { usageType: 'licensed', type: 'credit' }),
      makeItem('positive', 1),
      makeItem('negative', -1),
    ];

    expect(script.beforeItemCreation({ items }, {}, context)).toEqual({
      items: [
        { key: 'zero_debit', creationStrategy: 'doNotCreate' },
        { key: 'zero_credit', creationStrategy: 'doNotCreate' },
        { key: 'zero_rate_card', creationStrategy: 'doNotCreate' },
        { key: 'zero_licensed_debit', creationStrategy: 'invoice' },
        { key: 'zero_licensed_credit', creationStrategy: 'invoice' },
        { key: 'positive', creationStrategy: 'invoice' },
        { key: 'negative', creationStrategy: 'invoice' },
      ],
    });
  });

  test('limits zero-quantity removal to matching Product metadata when configured', () => {
    const config: RemoveZeroQuantityMeteredItemsBeforeCreationConfig = {
      metadataMatcher: { key: 'billing_treatment', value: 'drop_zero' },
    };
    const items = [
      makeItem('matched', 0, {
        productMetadata: { billing_treatment: ' DROP_ZERO ' },
      }),
      makeItem('matched_nonzero', 2, {
        productMetadata: { billing_treatment: 'drop_zero' },
      }),
      makeItem('matched_licensed', 0, {
        usageType: 'licensed',
        productMetadata: { billing_treatment: 'drop_zero' },
      }),
      makeItem('different_value', 0, {
        productMetadata: { billing_treatment: 'keep' },
      }),
      makeItem('missing_key', 0, { productMetadata: { other_key: 'drop_zero' } }),
      makeItem('price_metadata_only', 0, {
        priceMetadata: { billing_treatment: 'drop_zero' },
      }),
      makeRateCardItem('rate_card_metadata_only', 0),
    ];

    expect(script.beforeItemCreation({ items }, config, context)).toEqual({
      items: [
        { key: 'matched', creationStrategy: 'doNotCreate' },
        { key: 'matched_nonzero', creationStrategy: 'invoice' },
        { key: 'matched_licensed', creationStrategy: 'invoice' },
        { key: 'different_value', creationStrategy: 'invoice' },
        { key: 'missing_key', creationStrategy: 'invoice' },
        { key: 'price_metadata_only', creationStrategy: 'invoice' },
        { key: 'rate_card_metadata_only', creationStrategy: 'invoice' },
      ],
    });
  });

  test('handles overage rates, license fees, and unavailable usage types', () => {
    const rateCardItem = makeRateCardItem('rate_card', 0);
    if (rateCardItem.priceKind !== 'rateCardRate') {
      throw new Error('Expected a rate-card item');
    }
    const { priceKind, rateCardRate, ...baseItem } = rateCardItem;
    const missingUsageType = makeItem('missing_usage_type', 0);
    const missingRecurring = makeItem('missing_recurring', 0);
    if (
      missingUsageType.priceKind !== 'price' ||
      missingRecurring.priceKind !== 'price'
    ) {
      throw new Error('Expected Price items');
    }
    missingUsageType.price.recurring!.usageType = undefined;
    missingRecurring.price.recurring = undefined;

    const items: Billing.RecurringBillingItemHandling.Item[] = [
      {
        ...baseItem,
        key: 'overage',
        priceKind: 'customPricingUnitOverageRate',
        customPricingUnitOverageRate: {
          id: 'overage_test',
          metadata: {},
          rateCard: rateCardRate.rateCard,
          customPricingUnit: 'unit_test',
          unitAmount: Decimal.from(1),
        },
      },
      {
        ...baseItem,
        key: 'license_fee',
        priceKind: 'licenseFee',
        licenseFee: {
          id: 'license_test',
          metadata: {},
          serviceInterval: 'month',
          serviceIntervalCount: 1,
          tiers: [],
          currency: 'usd',
        },
      },
      { ...baseItem, key: 'other', priceKind: 'other', otherPriceKind: 'unknown' },
      { ...baseItem, key: 'missing_price_kind' },
      missingUsageType,
      missingRecurring,
    ];

    expect(script.beforeItemCreation({ items }, {}, context)).toEqual({
      items: [
        { key: 'overage', creationStrategy: 'doNotCreate' },
        { key: 'license_fee', creationStrategy: 'invoice' },
        { key: 'other', creationStrategy: 'invoice' },
        { key: 'missing_price_kind', creationStrategy: 'invoice' },
        { key: 'missing_usage_type', creationStrategy: 'invoice' },
        { key: 'missing_recurring', creationStrategy: 'invoice' },
      ],
    });
  });

  test('passes created items through filtering and grouping', () => {
    const items = [makeItem('first', 1), makeItem('second', 2)];

    expect(script.filterItems({ items }, {}, context)).toEqual({
      items: [{ key: 'first' }, { key: 'second' }],
    });
    expect(script.groupItems({ items }, {}, context)).toEqual({
      groups: [
        {
          items: [{ key: 'first' }, { key: 'second' }],
          setsLatestInvoice: true,
        },
      ],
    });
    expect(script.groupItems({ items: [] }, {}, context)).toEqual({ groups: [] });
  });
});
