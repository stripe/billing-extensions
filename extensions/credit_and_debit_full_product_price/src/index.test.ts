import { describe, test, expect } from 'vitest';
import type { Billing, Context } from '@stripe/extensibility-sdk/extensions';
import CreditAndDebitFullProductPrice, {
  subtractInterval,
  type CreditAndDebitFullProductPriceConfig,
} from './index.js';
import { Decimal } from '@stripe/extensibility-sdk/stdlib';

describe('Credit and debit full product price', () => {
  const mockContext: Context = {
    type: 'script',
    id: 'script_test123',
    livemode: false,
    stripeContext: 'acct_test123',
    clockTime: '2023-01-01T00:00:00Z',
  };

  // Default config used across most tests
  const config: CreditAndDebitFullProductPriceConfig = {
    metadataKey: 'no_prorations',
    metadataValue: 'yes',
  };

  const makeDebitItem = (
    metadata: Record<string, string>,
    overrides = {}
  ): Billing.Prorations.ProratableItem => ({
    key: 'item_1',
    type: 'debit',
    priceKind: 'price',
    price: {
      id: 'price_123',
      metadata: {},
      product: {
        id: 'prod_123',
        name: 'Test Product',
        metadata,
      },
      billingScheme: 'per_unit',
      type: 'recurring',
      currency: 'usd',
      recurring: {
        interval: 'month',
        intervalCount: 1,
      },
      tiers: [],
    },
    servicePeriod: {
      startDate: new Date('2023-01-01T00:00:00.000Z'),
      endDate: new Date('2023-01-15T00:00:00.000Z'),
    },
    isProration: true,
    currentProrationFactor: Decimal.from(0.5),
    priceIntervalDuration: 2592000,
    ...overrides,
  });

  describe('matching configured metadata key and value', () => {
    test('should set proration factor to 1.0 for debit when metadata matches', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [makeDebitItem({ no_prorations: 'yes' })],
      };

      const result = new CreditAndDebitFullProductPrice().prorateItems(
        request,
        config,
        mockContext
      );

      expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
      // End date is unchanged; start date is computed from end_date - 1 MONTH
      expect(result.items[0].lineItemPeriod.endDate).toEqual(
        request.items[0].servicePeriod.endDate
      );
      expect(result.items[0].lineItemPeriod.startDate).toEqual(
        new Date('2022-12-15T00:00:00.000Z')
      );
    });

    test('should match metadata value case-insensitively', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [makeDebitItem({ no_prorations: 'YES' })],
      };

      const result = new CreditAndDebitFullProductPrice().prorateItems(
        request,
        config,
        mockContext
      );

      expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
    });

    test('should trim whitespace from metadata value before comparing', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [makeDebitItem({ no_prorations: '  yes  ' })],
      };

      const result = new CreditAndDebitFullProductPrice().prorateItems(
        request,
        config,
        mockContext
      );

      expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
    });

    test('should use configured metadataKey to look up product metadata', () => {
      const customConfig: CreditAndDebitFullProductPriceConfig = {
        metadataKey: 'billing_full_charge',
        metadataValue: 'enabled',
      };
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [makeDebitItem({ billing_full_charge: 'enabled' })],
      };

      const result = new CreditAndDebitFullProductPrice().prorateItems(
        request,
        customConfig,
        mockContext
      );

      expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
    });

    test('should set proration factor to -1.0 for credit items when metadata matches', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'credit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              product: {
                id: 'prod_123',
                name: 'Test Product',
                metadata: { no_prorations: 'yes' },
              },
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              recurring: { interval: 'month', intervalCount: 1 },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-15T00:00:00.000Z'),
            },
            isProration: true,
            currentProrationFactor: Decimal.from(-0.5),
            priceIntervalDuration: 2592000,
          },
        ],
      };

      const result = new CreditAndDebitFullProductPrice().prorateItems(
        request,
        config,
        mockContext
      );

      expect(result.items[0].prorationFactor.toNumber()).toBe(-1.0);
      expect(result.items[0].lineItemPeriod.endDate).toEqual(
        request.items[0].servicePeriod.endDate
      );
      expect(result.items[0].lineItemPeriod.startDate).toEqual(
        new Date('2022-12-15T00:00:00.000Z')
      );
    });
  });

  describe('non-matching metadata', () => {
    test('should preserve current proration factor when metadata key is not set', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [makeDebitItem({})],
      };

      const result = new CreditAndDebitFullProductPrice().prorateItems(
        request,
        config,
        mockContext
      );

      expect(result.items[0].prorationFactor.toNumber()).toBe(0.5);
      expect(result.items[0].lineItemPeriod).toEqual(request.items[0].servicePeriod);
    });

    test('should preserve current proration factor when metadata value does not match', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [makeDebitItem({ no_prorations: 'no' })],
      };

      const result = new CreditAndDebitFullProductPrice().prorateItems(
        request,
        config,
        mockContext
      );

      expect(result.items[0].prorationFactor.toNumber()).toBe(0.5);
    });

    test('should preserve current proration factor when metadata key does not match configured key', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [makeDebitItem({ different_key: 'yes' })],
      };

      const result = new CreditAndDebitFullProductPrice().prorateItems(
        request,
        config,
        mockContext
      );

      expect(result.items[0].prorationFactor.toNumber()).toBe(0.5);
    });

    test('should preserve current proration factor when metadata value is an arbitrary non-matching string', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [makeDebitItem({ no_prorations: 'some_random_value' })],
      };

      const result = new CreditAndDebitFullProductPrice().prorateItems(
        request,
        config,
        mockContext
      );

      expect(result.items[0].prorationFactor.toNumber()).toBe(0.5);
    });

    test('should preserve current proration factor when product metadata is empty', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [makeDebitItem({})],
      };

      const result = new CreditAndDebitFullProductPrice().prorateItems(
        request,
        config,
        mockContext
      );

      expect(result.items[0].prorationFactor.toNumber()).toBe(0.5);
    });

    test('should preserve negative proration factor for credit items without matching metadata', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'credit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              recurring: { interval: 'month', intervalCount: 1 },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-15T00:00:00.000Z'),
            },
            isProration: true,
            currentProrationFactor: Decimal.from(-0.5),
            priceIntervalDuration: 2592000,
          },
        ],
      };

      const result = new CreditAndDebitFullProductPrice().prorateItems(
        request,
        config,
        mockContext
      );

      expect(result.items[0].prorationFactor.toNumber()).toBe(-0.5);
    });
  });

  describe('multiple items', () => {
    test('should handle mixed items — some matching, some not', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          makeDebitItem({ no_prorations: 'yes' }),
          {
            key: 'item_2',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_456',
              metadata: {},
              product: { id: 'prod_456', name: 'Another Product', metadata: {} },
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              recurring: { interval: 'month', intervalCount: 1 },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-10T00:00:00.000Z'),
            },
            isProration: true,
            currentProrationFactor: Decimal.from(0.3),
            priceIntervalDuration: 2592000,
          },
        ],
      };

      const result = new CreditAndDebitFullProductPrice().prorateItems(
        request,
        config,
        mockContext
      );

      expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
      expect(result.items[0].lineItemPeriod.endDate).toEqual(
        request.items[0].servicePeriod.endDate
      );
      expect(result.items[0].lineItemPeriod.startDate).toEqual(
        new Date('2022-12-15T00:00:00.000Z')
      );

      expect(result.items[1].prorationFactor.toNumber()).toBe(0.3);
      expect(result.items[1].lineItemPeriod).toEqual(request.items[1].servicePeriod);
    });

    test('should handle all items matching configured metadata', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          makeDebitItem({ no_prorations: 'yes' }),
          {
            key: 'item_2',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_456',
              metadata: {},
              product: {
                id: 'prod_456',
                name: 'Another Product',
                metadata: { no_prorations: 'YES' },
              },
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              recurring: { interval: 'month', intervalCount: 1 },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-10T00:00:00.000Z'),
            },
            isProration: true,
            currentProrationFactor: Decimal.from(0.3),
            priceIntervalDuration: 2592000,
          },
          {
            key: 'item_3',
            type: 'credit',
            priceKind: 'price',
            price: {
              id: 'price_789',
              metadata: {},
              product: {
                id: 'prod_789',
                name: 'Credit Product',
                metadata: { no_prorations: 'yes' },
              },
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              recurring: { interval: 'month', intervalCount: 1 },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-20T00:00:00.000Z'),
            },
            isProration: true,
            currentProrationFactor: Decimal.from(-0.65),
            priceIntervalDuration: 2592000,
          },
        ],
      };

      const result = new CreditAndDebitFullProductPrice().prorateItems(
        request,
        config,
        mockContext
      );

      expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
      expect(result.items[1].prorationFactor.toNumber()).toBe(1.0);
      expect(result.items[2].prorationFactor.toNumber()).toBe(-1.0);
    });
  });

  describe('edge cases', () => {
    test('should handle items with proration factor of 0', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          makeDebitItem(
            { no_prorations: 'yes' },
            { currentProrationFactor: Decimal.from(0) }
          ),
        ],
      };

      const result = new CreditAndDebitFullProductPrice().prorateItems(
        request,
        config,
        mockContext
      );

      expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
    });

    test('should handle items with proration factor already at 1.0', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          makeDebitItem(
            { no_prorations: 'yes' },
            { currentProrationFactor: Decimal.from(1.0) }
          ),
        ],
      };

      const result = new CreditAndDebitFullProductPrice().prorateItems(
        request,
        config,
        mockContext
      );

      expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
    });

    test('should handle non-proration items (isProration: false)', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          makeDebitItem(
            { no_prorations: 'yes' },
            { isProration: false, currentProrationFactor: Decimal.from(1.0) }
          ),
        ],
      };

      const result = new CreditAndDebitFullProductPrice().prorateItems(
        request,
        config,
        mockContext
      );

      expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
    });

    test('should handle different recurring intervals (yearly)', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          makeDebitItem(
            { no_prorations: 'yes' },
            {
              price: {
                id: 'price_123',
                metadata: {},
                product: {
                  id: 'prod_123',
                  name: 'Test Product',
                  metadata: { no_prorations: 'yes' },
                },
                billingScheme: 'per_unit',
                type: 'recurring',
                currency: 'usd',
                recurring: { interval: 'year' as const, intervalCount: 1 },
                tiers: [],
              },
              priceIntervalDuration: 31536000,
            }
          ),
        ],
      };

      const result = new CreditAndDebitFullProductPrice().prorateItems(
        request,
        config,
        mockContext
      );

      expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
    });

    test('should handle empty items array', () => {
      const request: Billing.Prorations.ProrateItemsInput = { items: [] };

      const result = new CreditAndDebitFullProductPrice().prorateItems(
        request,
        config,
        mockContext
      );

      expect(result.items).toEqual([]);
    });
  });

  describe('line item period preservation for non-matching items', () => {
    test('should preserve the original service period for non-matching items', () => {
      const originalServicePeriod = {
        startDate: new Date('2023-01-15T00:00:00.000Z'),
        endDate: new Date('2023-02-01T00:00:00.000Z'),
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            ...makeDebitItem({}),
            servicePeriod: originalServicePeriod,
          },
        ],
      };

      const result = new CreditAndDebitFullProductPrice().prorateItems(
        request,
        config,
        mockContext
      );

      expect(result.items[0].lineItemPeriod).toBe(originalServicePeriod);
    });
  });
});

describe('subtractInterval', () => {
  describe('day interval', () => {
    test('subtracts exact days', () => {
      const end = new Date('2023-03-15T00:00:00.000Z');
      expect(subtractInterval(end, 'day', 1)).toEqual(
        new Date('2023-03-14T00:00:00.000Z')
      );
    });

    test('subtracts multiple days across month boundary', () => {
      const end = new Date('2023-03-02T00:00:00.000Z');
      expect(subtractInterval(end, 'day', 5)).toEqual(
        new Date('2023-02-25T00:00:00.000Z')
      );
    });

    test('subtracts multiple days across year boundary', () => {
      const end = new Date('2023-01-03T00:00:00.000Z');
      expect(subtractInterval(end, 'day', 5)).toEqual(
        new Date('2022-12-29T00:00:00.000Z')
      );
    });
  });

  describe('week interval', () => {
    test('subtracts exact weeks', () => {
      const end = new Date('2023-03-15T00:00:00.000Z');
      expect(subtractInterval(end, 'week', 1)).toEqual(
        new Date('2023-03-08T00:00:00.000Z')
      );
    });

    test('subtracts multiple weeks across month boundary', () => {
      const end = new Date('2023-03-07T00:00:00.000Z');
      expect(subtractInterval(end, 'week', 2)).toEqual(
        new Date('2023-02-21T00:00:00.000Z')
      );
    });

    test('subtracts weeks across year boundary', () => {
      const end = new Date('2023-01-04T00:00:00.000Z');
      expect(subtractInterval(end, 'week', 2)).toEqual(
        new Date('2022-12-21T00:00:00.000Z')
      );
    });
  });

  describe('month interval', () => {
    test('subtracts one month for a normal date', () => {
      const end = new Date('2023-03-15T00:00:00.000Z');
      expect(subtractInterval(end, 'month', 1)).toEqual(
        new Date('2023-02-15T00:00:00.000Z')
      );
    });

    test('subtracts two months for a normal date', () => {
      const end = new Date('2023-03-15T00:00:00.000Z');
      expect(subtractInterval(end, 'month', 2)).toEqual(
        new Date('2023-01-15T00:00:00.000Z')
      );
    });

    test('subtracts one month across year boundary', () => {
      const end = new Date('2023-01-20T00:00:00.000Z');
      expect(subtractInterval(end, 'month', 1)).toEqual(
        new Date('2022-12-20T00:00:00.000Z')
      );
    });

    test('subtracts multiple months across year boundary', () => {
      const end = new Date('2023-02-10T00:00:00.000Z');
      expect(subtractInterval(end, 'month', 3)).toEqual(
        new Date('2022-11-10T00:00:00.000Z')
      );
    });

    test('clamps March 31 minus 1 month to Feb 28 in a non-leap year', () => {
      const end = new Date('2023-03-31T00:00:00.000Z');
      expect(subtractInterval(end, 'month', 1)).toEqual(
        new Date('2023-02-28T00:00:00.000Z')
      );
    });

    test('clamps March 31 minus 1 month to Feb 29 in a leap year', () => {
      const end = new Date('2024-03-31T00:00:00.000Z');
      expect(subtractInterval(end, 'month', 1)).toEqual(
        new Date('2024-02-29T00:00:00.000Z')
      );
    });

    test('does not clamp March 31 minus 2 months (January has 31 days)', () => {
      const end = new Date('2023-03-31T00:00:00.000Z');
      expect(subtractInterval(end, 'month', 2)).toEqual(
        new Date('2023-01-31T00:00:00.000Z')
      );
    });

    test('clamps May 31 minus 1 month to April 30', () => {
      const end = new Date('2023-05-31T00:00:00.000Z');
      expect(subtractInterval(end, 'month', 1)).toEqual(
        new Date('2023-04-30T00:00:00.000Z')
      );
    });

    test('subtracts 13 months across two year boundaries', () => {
      const end = new Date('2023-03-15T00:00:00.000Z');
      expect(subtractInterval(end, 'month', 13)).toEqual(
        new Date('2022-02-15T00:00:00.000Z')
      );
    });

    test('preserves time-of-day component', () => {
      const end = new Date('2023-03-15T14:30:45.123Z');
      expect(subtractInterval(end, 'month', 1)).toEqual(
        new Date('2023-02-15T14:30:45.123Z')
      );
    });
  });

  describe('year interval', () => {
    test('subtracts one year for a normal date', () => {
      const end = new Date('2023-06-15T00:00:00.000Z');
      expect(subtractInterval(end, 'year', 1)).toEqual(
        new Date('2022-06-15T00:00:00.000Z')
      );
    });

    test('subtracts multiple years', () => {
      const end = new Date('2023-06-15T00:00:00.000Z');
      expect(subtractInterval(end, 'year', 3)).toEqual(
        new Date('2020-06-15T00:00:00.000Z')
      );
    });

    test('subtracts one year from March 31 (no clamping needed)', () => {
      const end = new Date('2023-03-31T00:00:00.000Z');
      expect(subtractInterval(end, 'year', 1)).toEqual(
        new Date('2022-03-31T00:00:00.000Z')
      );
    });

    test('clamps Feb 29 minus 1 year to Feb 28 when target year is not a leap year', () => {
      const end = new Date('2024-02-29T00:00:00.000Z');
      expect(subtractInterval(end, 'year', 1)).toEqual(
        new Date('2023-02-28T00:00:00.000Z')
      );
    });

    test('keeps Feb 29 when target year is also a leap year', () => {
      const end = new Date('2024-02-29T00:00:00.000Z');
      expect(subtractInterval(end, 'year', 4)).toEqual(
        new Date('2020-02-29T00:00:00.000Z')
      );
    });

    test('preserves time-of-day component', () => {
      const end = new Date('2023-06-15T08:15:30.500Z');
      expect(subtractInterval(end, 'year', 1)).toEqual(
        new Date('2022-06-15T08:15:30.500Z')
      );
    });
  });
});

describe('lineItemPeriod start date override', () => {
  const mockContext: Context = {
    type: 'script',
    id: 'script_test123',
    livemode: false,
    stripeContext: 'acct_test123',
    clockTime: '2023-01-01T00:00:00Z',
  };

  const config: CreditAndDebitFullProductPriceConfig = {
    metadataKey: 'no_prorations',
    metadataValue: 'yes',
  };

  const makeItem = (
    endDate: Date,
    interval: Billing.Prorations.RecurringPriceInterval,
    intervalCount: number,
    metadata: Record<string, string> = { no_prorations: 'yes' }
  ): Billing.Prorations.ProratableItem => ({
    key: 'item_1',
    type: 'debit',
    priceKind: 'price',
    price: {
      id: 'price_123',
      metadata: {},
      product: { id: 'prod_123', name: 'Test Product', metadata },
      billingScheme: 'per_unit',
      type: 'recurring',
      currency: 'usd',
      recurring: { interval, intervalCount },
      tiers: [],
    },
    servicePeriod: {
      startDate: new Date('2023-01-15T00:00:00.000Z'),
      endDate: endDate,
    },
    isProration: true,
    currentProrationFactor: Decimal.from(0.5),
    priceIntervalDuration: 2592000,
  });

  test('overrides start date for monthly interval — normal date', () => {
    const endDate = new Date('2023-02-15T00:00:00.000Z');
    const result = new CreditAndDebitFullProductPrice().prorateItems(
      { items: [makeItem(endDate, 'month', 1)] },
      config,
      mockContext
    );
    expect(result.items[0].lineItemPeriod.endDate).toEqual(endDate);
    expect(result.items[0].lineItemPeriod.startDate).toEqual(
      new Date('2023-01-15T00:00:00.000Z')
    );
  });

  test('overrides start date — March 31 monthly, non-leap year → Feb 28', () => {
    const endDate = new Date('2023-03-31T00:00:00.000Z');
    const result = new CreditAndDebitFullProductPrice().prorateItems(
      { items: [makeItem(endDate, 'month', 1)] },
      config,
      mockContext
    );
    expect(result.items[0].lineItemPeriod.startDate).toEqual(
      new Date('2023-02-28T00:00:00.000Z')
    );
    expect(result.items[0].lineItemPeriod.endDate).toEqual(endDate);
  });

  test('overrides start date — March 31 monthly, leap year → Feb 29', () => {
    const endDate = new Date('2024-03-31T00:00:00.000Z');
    const result = new CreditAndDebitFullProductPrice().prorateItems(
      { items: [makeItem(endDate, 'month', 1)] },
      config,
      mockContext
    );
    expect(result.items[0].lineItemPeriod.startDate).toEqual(
      new Date('2024-02-29T00:00:00.000Z')
    );
  });

  test('overrides start date — March 31, 2 months back → Jan 31', () => {
    const endDate = new Date('2023-03-31T00:00:00.000Z');
    const result = new CreditAndDebitFullProductPrice().prorateItems(
      { items: [makeItem(endDate, 'month', 2)] },
      config,
      mockContext
    );
    expect(result.items[0].lineItemPeriod.startDate).toEqual(
      new Date('2023-01-31T00:00:00.000Z')
    );
  });

  test('overrides start date for yearly interval — normal date', () => {
    const endDate = new Date('2023-06-15T00:00:00.000Z');
    const result = new CreditAndDebitFullProductPrice().prorateItems(
      { items: [makeItem(endDate, 'year', 1)] },
      config,
      mockContext
    );
    expect(result.items[0].lineItemPeriod.startDate).toEqual(
      new Date('2022-06-15T00:00:00.000Z')
    );
  });

  test('overrides start date — Feb 29 yearly, target not leap year → Feb 28', () => {
    const endDate = new Date('2024-02-29T00:00:00.000Z');
    const result = new CreditAndDebitFullProductPrice().prorateItems(
      { items: [makeItem(endDate, 'year', 1)] },
      config,
      mockContext
    );
    expect(result.items[0].lineItemPeriod.startDate).toEqual(
      new Date('2023-02-28T00:00:00.000Z')
    );
  });

  test('overrides start date — Feb 29 yearly, target is also a leap year → Feb 29', () => {
    const endDate = new Date('2024-02-29T00:00:00.000Z');
    const result = new CreditAndDebitFullProductPrice().prorateItems(
      { items: [makeItem(endDate, 'year', 4)] },
      config,
      mockContext
    );
    expect(result.items[0].lineItemPeriod.startDate).toEqual(
      new Date('2020-02-29T00:00:00.000Z')
    );
  });

  test('overrides start date for daily interval', () => {
    const endDate = new Date('2023-03-15T00:00:00.000Z');
    const result = new CreditAndDebitFullProductPrice().prorateItems(
      { items: [makeItem(endDate, 'day', 30)] },
      config,
      mockContext
    );
    expect(result.items[0].lineItemPeriod.startDate).toEqual(
      new Date('2023-02-13T00:00:00.000Z')
    );
  });

  test('overrides start date for weekly interval', () => {
    const endDate = new Date('2023-03-15T00:00:00.000Z');
    const result = new CreditAndDebitFullProductPrice().prorateItems(
      { items: [makeItem(endDate, 'week', 2)] },
      config,
      mockContext
    );
    expect(result.items[0].lineItemPeriod.startDate).toEqual(
      new Date('2023-03-01T00:00:00.000Z')
    );
  });

  test('falls back to servicePeriod startDate when price has no recurring info', () => {
    const endDate = new Date('2023-02-15T00:00:00.000Z');
    const item: Billing.Prorations.ProratableItem = {
      ...makeItem(endDate, 'month', 1),
      priceKind: 'price' as const,
      price: {
        id: 'price_123',
        metadata: {},
        product: {
          id: 'prod_123',
          name: 'Test Product',
          metadata: { no_prorations: 'yes' },
        },
        billingScheme: 'per_unit',
        type: 'recurring',
        currency: 'usd',
        tiers: [],
      },
    };
    const result = new CreditAndDebitFullProductPrice().prorateItems(
      { items: [item] },
      config,
      mockContext
    );
    expect(result.items[0].lineItemPeriod.startDate).toEqual(
      item.servicePeriod.startDate
    );
  });
});

describe('non-price priceKind items', () => {
  const mockContext: Context = {
    type: 'script',
    id: 'script_test123',
    livemode: false,
    stripeContext: 'acct_test123',
    clockTime: '2023-01-01T00:00:00Z',
  };

  const config: CreditAndDebitFullProductPriceConfig = {
    metadataKey: 'no_prorations',
    metadataValue: 'yes',
  };

  test('preserves proration factor for licenseFee priceKind', () => {
    const item: Billing.Prorations.ProratableItem = {
      key: 'item_1',
      type: 'debit',
      priceKind: 'licenseFee',
      licenseFee: {
        id: 'lf_123',
        metadata: {},
        serviceInterval: 'month',
        serviceIntervalCount: 1,
        tiers: [],
        currency: 'usd',
      },
      servicePeriod: {
        startDate: new Date('2023-01-01T00:00:00.000Z'),
        endDate: new Date('2023-01-15T00:00:00.000Z'),
      },
      isProration: true,
      currentProrationFactor: Decimal.from(0.5),
      priceIntervalDuration: 2592000,
    };

    const result = new CreditAndDebitFullProductPrice().prorateItems(
      { items: [item] },
      config,
      mockContext
    );

    expect(result.items[0].prorationFactor.toNumber()).toBe(0.5);
    expect(result.items[0].lineItemPeriod).toEqual(item.servicePeriod);
  });

  test('preserves proration factor for rateCardRate priceKind', () => {
    const item: Billing.Prorations.ProratableItem = {
      key: 'item_1',
      type: 'debit',
      priceKind: 'rateCardRate',
      rateCardRate: {
        id: 'rcr_123',
        metadata: {},
        rateCard: {
          id: 'rc_456',
          currency: 'usd',
        },
        tiers: [],
      },
      servicePeriod: {
        startDate: new Date('2023-01-01T00:00:00.000Z'),
        endDate: new Date('2023-01-15T00:00:00.000Z'),
      },
      isProration: true,
      currentProrationFactor: Decimal.from(0.5),
      priceIntervalDuration: 2592000,
    };

    const result = new CreditAndDebitFullProductPrice().prorateItems(
      { items: [item] },
      config,
      mockContext
    );

    expect(result.items[0].prorationFactor.toNumber()).toBe(0.5);
    expect(result.items[0].lineItemPeriod).toEqual(item.servicePeriod);
  });

  test('preserves proration factor for customPricingUnitOverageRate priceKind', () => {
    const item: Billing.Prorations.ProratableItem = {
      key: 'item_1',
      type: 'debit',
      priceKind: 'customPricingUnitOverageRate',
      customPricingUnitOverageRate: {
        id: 'cpur_123',
        metadata: {},
        rateCard: {
          id: 'rc_456',
          currency: 'usd',
        },
        customPricingUnit: 'seat',
        unitAmount: Decimal.from(25),
      },
      servicePeriod: {
        startDate: new Date('2023-01-01T00:00:00.000Z'),
        endDate: new Date('2023-01-15T00:00:00.000Z'),
      },
      isProration: true,
      currentProrationFactor: Decimal.from(0.5),
      priceIntervalDuration: 2592000,
    };

    const result = new CreditAndDebitFullProductPrice().prorateItems(
      { items: [item] },
      config,
      mockContext
    );

    expect(result.items[0].prorationFactor.toNumber()).toBe(0.5);
    expect(result.items[0].lineItemPeriod).toEqual(item.servicePeriod);
  });

  test('preserves proration factor for other priceKind', () => {
    const item: Billing.Prorations.ProratableItem = {
      key: 'item_1',
      type: 'debit',
      priceKind: 'other',
      otherPriceKind: 'some_future_type',
      servicePeriod: {
        startDate: new Date('2023-01-01T00:00:00.000Z'),
        endDate: new Date('2023-01-15T00:00:00.000Z'),
      },
      isProration: true,
      currentProrationFactor: Decimal.from(0.5),
      priceIntervalDuration: 2592000,
    };

    const result = new CreditAndDebitFullProductPrice().prorateItems(
      { items: [item] },
      config,
      mockContext
    );

    expect(result.items[0].prorationFactor.toNumber()).toBe(0.5);
    expect(result.items[0].lineItemPeriod).toEqual(item.servicePeriod);
  });
});

describe('additional metadata matching edge cases', () => {
  const mockContext: Context = {
    type: 'script',
    id: 'script_test123',
    livemode: false,
    stripeContext: 'acct_test123',
    clockTime: '2023-01-01T00:00:00Z',
  };

  const makeDebitItem = (
    metadata: Record<string, string>,
    overrides = {}
  ): Billing.Prorations.ProratableItem => ({
    key: 'item_1',
    type: 'debit',
    priceKind: 'price',
    price: {
      id: 'price_123',
      metadata: {},
      product: {
        id: 'prod_123',
        name: 'Test Product',
        metadata,
      },
      billingScheme: 'per_unit',
      type: 'recurring',
      currency: 'usd',
      recurring: {
        interval: 'month',
        intervalCount: 1,
      },
      tiers: [],
    },
    servicePeriod: {
      startDate: new Date('2023-01-01T00:00:00.000Z'),
      endDate: new Date('2023-01-15T00:00:00.000Z'),
    },
    isProration: true,
    currentProrationFactor: Decimal.from(0.5),
    priceIntervalDuration: 2592000,
    ...overrides,
  });

  test('should trim whitespace from config metadataValue before comparing', () => {
    const config: CreditAndDebitFullProductPriceConfig = {
      metadataKey: 'no_prorations',
      metadataValue: '  yes  ',
    };
    const request: Billing.Prorations.ProrateItemsInput = {
      items: [makeDebitItem({ no_prorations: 'yes' })],
    };

    const result = new CreditAndDebitFullProductPrice().prorateItems(
      request,
      config,
      mockContext
    );

    expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
  });

  test('metadata key lookup is case-sensitive', () => {
    const config: CreditAndDebitFullProductPriceConfig = {
      metadataKey: 'no_prorations',
      metadataValue: 'yes',
    };
    const request: Billing.Prorations.ProrateItemsInput = {
      items: [makeDebitItem({ No_Prorations: 'yes' })],
    };

    const result = new CreditAndDebitFullProductPrice().prorateItems(
      request,
      config,
      mockContext
    );

    expect(result.items[0].prorationFactor.toNumber()).toBe(0.5);
  });

  test('matches when both config and product metadata values are empty strings', () => {
    const config: CreditAndDebitFullProductPriceConfig = {
      metadataKey: 'no_prorations',
      metadataValue: '',
    };
    const request: Billing.Prorations.ProrateItemsInput = {
      items: [makeDebitItem({ no_prorations: '' })],
    };

    const result = new CreditAndDebitFullProductPrice().prorateItems(
      request,
      config,
      mockContext
    );

    expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
  });

  test('does not match when config value is empty but product value is non-empty', () => {
    const config: CreditAndDebitFullProductPriceConfig = {
      metadataKey: 'no_prorations',
      metadataValue: '',
    };
    const request: Billing.Prorations.ProrateItemsInput = {
      items: [makeDebitItem({ no_prorations: 'yes' })],
    };

    const result = new CreditAndDebitFullProductPrice().prorateItems(
      request,
      config,
      mockContext
    );

    expect(result.items[0].prorationFactor.toNumber()).toBe(0.5);
  });
});

describe('credit items across different intervals', () => {
  const mockContext: Context = {
    type: 'script',
    id: 'script_test123',
    livemode: false,
    stripeContext: 'acct_test123',
    clockTime: '2023-01-01T00:00:00Z',
  };

  const config: CreditAndDebitFullProductPriceConfig = {
    metadataKey: 'no_prorations',
    metadataValue: 'yes',
  };

  const makeCreditItem = (
    interval: Billing.Prorations.RecurringPriceInterval,
    intervalCount: number,
    endDate: Date,
    overrides = {}
  ): Billing.Prorations.ProratableItem => ({
    key: 'item_1',
    type: 'credit',
    priceKind: 'price',
    price: {
      id: 'price_123',
      metadata: {},
      product: {
        id: 'prod_123',
        name: 'Test Product',
        metadata: { no_prorations: 'yes' },
      },
      billingScheme: 'per_unit',
      type: 'recurring',
      currency: 'usd',
      recurring: { interval, intervalCount },
      tiers: [],
    },
    servicePeriod: {
      startDate: new Date('2023-01-01T00:00:00.000Z'),
      endDate,
    },
    isProration: true,
    currentProrationFactor: Decimal.from(-0.5),
    priceIntervalDuration: 2592000,
    ...overrides,
  });

  test('sets factor to -1.0 and overrides start date for daily credit', () => {
    const endDate = new Date('2023-01-15T00:00:00.000Z');
    const result = new CreditAndDebitFullProductPrice().prorateItems(
      { items: [makeCreditItem('day', 30, endDate)] },
      config,
      mockContext
    );

    expect(result.items[0].prorationFactor.toNumber()).toBe(-1.0);
    expect(result.items[0].lineItemPeriod.endDate).toEqual(endDate);
    expect(result.items[0].lineItemPeriod.startDate).toEqual(
      new Date('2022-12-16T00:00:00.000Z')
    );
  });

  test('sets factor to -1.0 and overrides start date for weekly credit', () => {
    const endDate = new Date('2023-01-15T00:00:00.000Z');
    const result = new CreditAndDebitFullProductPrice().prorateItems(
      { items: [makeCreditItem('week', 2, endDate)] },
      config,
      mockContext
    );

    expect(result.items[0].prorationFactor.toNumber()).toBe(-1.0);
    expect(result.items[0].lineItemPeriod.endDate).toEqual(endDate);
    expect(result.items[0].lineItemPeriod.startDate).toEqual(
      new Date('2023-01-01T00:00:00.000Z')
    );
  });

  test('sets factor to -1.0 and overrides start date for yearly credit', () => {
    const endDate = new Date('2023-06-15T00:00:00.000Z');
    const result = new CreditAndDebitFullProductPrice().prorateItems(
      { items: [makeCreditItem('year', 1, endDate)] },
      config,
      mockContext
    );

    expect(result.items[0].prorationFactor.toNumber()).toBe(-1.0);
    expect(result.items[0].lineItemPeriod.endDate).toEqual(endDate);
    expect(result.items[0].lineItemPeriod.startDate).toEqual(
      new Date('2022-06-15T00:00:00.000Z')
    );
  });
});

describe('multi-count interval matching', () => {
  const mockContext: Context = {
    type: 'script',
    id: 'script_test123',
    livemode: false,
    stripeContext: 'acct_test123',
    clockTime: '2023-01-01T00:00:00Z',
  };

  const config: CreditAndDebitFullProductPriceConfig = {
    metadataKey: 'no_prorations',
    metadataValue: 'yes',
  };

  test('overrides start date correctly for bi-monthly (intervalCount: 2)', () => {
    const endDate = new Date('2023-03-15T00:00:00.000Z');
    const item: Billing.Prorations.ProratableItem = {
      key: 'item_1',
      type: 'debit',
      priceKind: 'price',
      price: {
        id: 'price_123',
        metadata: {},
        product: {
          id: 'prod_123',
          name: 'Test Product',
          metadata: { no_prorations: 'yes' },
        },
        billingScheme: 'per_unit',
        type: 'recurring',
        currency: 'usd',
        recurring: { interval: 'month', intervalCount: 2 },
        tiers: [],
      },
      servicePeriod: {
        startDate: new Date('2023-02-01T00:00:00.000Z'),
        endDate,
      },
      isProration: true,
      currentProrationFactor: Decimal.from(0.5),
      priceIntervalDuration: 5184000,
    };

    const result = new CreditAndDebitFullProductPrice().prorateItems(
      { items: [item] },
      config,
      mockContext
    );

    expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
    expect(result.items[0].lineItemPeriod.endDate).toEqual(endDate);
    expect(result.items[0].lineItemPeriod.startDate).toEqual(
      new Date('2023-01-15T00:00:00.000Z')
    );
  });

  test('overrides start date correctly for quarterly (intervalCount: 3)', () => {
    const endDate = new Date('2023-06-15T00:00:00.000Z');
    const item: Billing.Prorations.ProratableItem = {
      key: 'item_1',
      type: 'debit',
      priceKind: 'price',
      price: {
        id: 'price_123',
        metadata: {},
        product: {
          id: 'prod_123',
          name: 'Test Product',
          metadata: { no_prorations: 'yes' },
        },
        billingScheme: 'per_unit',
        type: 'recurring',
        currency: 'usd',
        recurring: { interval: 'month', intervalCount: 3 },
        tiers: [],
      },
      servicePeriod: {
        startDate: new Date('2023-04-01T00:00:00.000Z'),
        endDate,
      },
      isProration: true,
      currentProrationFactor: Decimal.from(0.5),
      priceIntervalDuration: 7776000,
    };

    const result = new CreditAndDebitFullProductPrice().prorateItems(
      { items: [item] },
      config,
      mockContext
    );

    expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
    expect(result.items[0].lineItemPeriod.endDate).toEqual(endDate);
    expect(result.items[0].lineItemPeriod.startDate).toEqual(
      new Date('2023-03-15T00:00:00.000Z')
    );
  });
});

describe('credit items with correspondingDebit', () => {
  const mockContext: Context = {
    type: 'script',
    id: 'script_test123',
    livemode: false,
    stripeContext: 'acct_test123',
    clockTime: '2023-01-01T00:00:00Z',
  };

  const config: CreditAndDebitFullProductPriceConfig = {
    metadataKey: 'no_prorations',
    metadataValue: 'yes',
  };

  test('sets factor to -1.0 for credit with correspondingDebit when metadata matches', () => {
    const item: Billing.Prorations.ProratableItem = {
      key: 'item_1',
      type: 'credit',
      priceKind: 'price',
      price: {
        id: 'price_123',
        metadata: {},
        product: {
          id: 'prod_123',
          name: 'Test Product',
          metadata: { no_prorations: 'yes' },
        },
        billingScheme: 'per_unit',
        type: 'recurring',
        currency: 'usd',
        recurring: { interval: 'month', intervalCount: 1 },
        tiers: [],
      },
      servicePeriod: {
        startDate: new Date('2023-01-10T00:00:00.000Z'),
        endDate: new Date('2023-01-15T00:00:00.000Z'),
      },
      isProration: true,
      currentProrationFactor: Decimal.from(-0.3),
      priceIntervalDuration: 2592000,
      correspondingDebit: {
        servicePeriod: {
          startDate: new Date('2023-01-01T00:00:00.000Z'),
          endDate: new Date('2023-01-20T00:00:00.000Z'),
        },
      },
    };

    const result = new CreditAndDebitFullProductPrice().prorateItems(
      { items: [item] },
      config,
      mockContext
    );

    expect(result.items[0].prorationFactor.toNumber()).toBe(-1.0);
    expect(result.items[0].lineItemPeriod.endDate).toEqual(
      new Date('2023-01-15T00:00:00.000Z')
    );
    expect(result.items[0].lineItemPeriod.startDate).toEqual(
      new Date('2022-12-15T00:00:00.000Z')
    );
  });

  test('preserves factor for credit with correspondingDebit when metadata does not match', () => {
    const item: Billing.Prorations.ProratableItem = {
      key: 'item_1',
      type: 'credit',
      priceKind: 'price',
      price: {
        id: 'price_123',
        metadata: {},
        product: {
          id: 'prod_123',
          name: 'Test Product',
          metadata: {},
        },
        billingScheme: 'per_unit',
        type: 'recurring',
        currency: 'usd',
        recurring: { interval: 'month', intervalCount: 1 },
        tiers: [],
      },
      servicePeriod: {
        startDate: new Date('2023-01-10T00:00:00.000Z'),
        endDate: new Date('2023-01-15T00:00:00.000Z'),
      },
      isProration: true,
      currentProrationFactor: Decimal.from(-0.3),
      priceIntervalDuration: 2592000,
      correspondingDebit: {
        servicePeriod: {
          startDate: new Date('2023-01-01T00:00:00.000Z'),
          endDate: new Date('2023-01-20T00:00:00.000Z'),
        },
      },
    };

    const result = new CreditAndDebitFullProductPrice().prorateItems(
      { items: [item] },
      config,
      mockContext
    );

    expect(result.items[0].prorationFactor.toNumber()).toBe(-0.3);
    expect(result.items[0].lineItemPeriod).toEqual(item.servicePeriod);
  });
});
