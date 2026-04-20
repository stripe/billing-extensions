import { describe, expect, test } from 'vitest';

import type { Billing, Context } from '@stripe/extensibility-sdk/extensions';
import { Decimal } from '@stripe/extensibility-sdk/stdlib';
import MyProrations, { type MyProrationsConfig } from './index.js';

describe('Custom Interval Prorations', () => {
  const mockContext: Context = {
    type: 'script',
    id: 'script_test123',
    livemode: false,
    stripeContext: 'acct_test123',
    clockTime: '2023-01-01T00:00:00Z',
  };

  describe('DAY granularity', () => {
    const config: MyProrationsConfig = {
      customInterval: 'day',
      roundingMode: 'round_nearest',
    };

    test('daily subscription - rounds 0.55 Days to 1 Day', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'day',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-01T13:12:00.000Z'), // 0.55 Days (13.2 Hours)
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.55'),
            priceIntervalDuration: 86400,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 0.55 Days rounds to 1 Day
      // proration_factor = 1 / 1 = 1.0
      expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
      expect(result.items[0].lineItemPeriod.endDate).toEqual(
        new Date('2023-01-01T13:12:00.000Z')
      );
      // 1 Day before end: 2022-12-31T13:12:00.000Z
      expect(result.items[0].lineItemPeriod.startDate).toEqual(
        new Date('2022-12-31T13:12:00.000Z')
      );
    });

    test('daily subscription - rounds 0.4 Days down to 0 Days', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'day',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-01T09:36:00.000Z'), // 0.4 Days (9.6 Hours)
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.4'),
            priceIntervalDuration: 86400,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 0.4 Days rounds down to 0 Days
      // proration_factor = 0 / 1 = 0
      expect(result.items[0].prorationFactor.toNumber()).toBe(0);
      expect(result.items[0].lineItemPeriod.startDate).toEqual(
        new Date('2023-01-01T09:36:00.000Z')
      );
    });

    test('Weekly subscription - 4 Days out of 7', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'week',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-05T00:00:00.000Z'), // 4 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.5714'),
            priceIntervalDuration: 604800,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 4 Days rounds to 4 Days
      // Full period = 7 Days
      // proration_factor = 4 / 7 ≈ 0.5714
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(0.5714, 4);
    });

    test('bi-Weekly subscription - 10 Days out of 14', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'week',
                intervalCount: 2,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-11T00:00:00.000Z'), // 10 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.7143'),
            priceIntervalDuration: 1209600,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 10 Days out of 14 Days (2 Weeks)
      // proration_factor = 10 / 14 ≈ 0.7143
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(0.7143, 4);
    });

    test('Monthly subscription - partial Month in Days', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-16T00:00:00.000Z'), // 15 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.5'),
            priceIntervalDuration: 2592000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 15 Days out of 31 Days (Dec 16 to Jan 16)
      // proration_factor = 15 / 31 ≈ 0.4839
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(0.4839, 4);
    });

    test('Yearly subscription - partial year in Days', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-07-03T00:00:00.000Z'), // 183 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.5014'),
            priceIntervalDuration: 31536000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 183 Days out of 365 Days
      // proration_factor = 183 / 365 ≈ 0.5014
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(0.5014, 4);
    });

    test('handles credit items with negative proration factor', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'credit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'day',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-01T13:12:00.000Z'), // 0.55 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.55'),
            priceIntervalDuration: 86400,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 0.55 Days rounds to 1 Day
      // For credit: proration_factor = -1
      expect(result.items[0].prorationFactor.toNumber()).toBe(-1.0);
    });
  });

  describe('Week granularity', () => {
    const config: MyProrationsConfig = {
      customInterval: 'week',
      roundingMode: 'round_nearest',
    };

    test('Weekly subscription - 0.5 Weeks rounds to 1 Week', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'week',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-04T12:00:00.000Z'), // 3.5 Days = 0.5 Weeks
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.5'),
            priceIntervalDuration: 604800,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 0.5 Weeks rounds to 1 Week
      // proration_factor = 1 / 1 = 1.0
      expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
      expect(result.items[0].lineItemPeriod.startDate).toEqual(
        new Date('2022-12-28T12:00:00.000Z')
      );
    });

    test('Weekly subscription - 0.4 Weeks rounds down to 0 Weeks', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'week',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-03T19:12:00.000Z'), // ~2.8 Days = 0.4 Weeks
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.4'),
            priceIntervalDuration: 604800,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 0.4 Weeks rounds down to 0 Weeks
      // proration_factor = 0 / 1 = 0
      expect(result.items[0].prorationFactor.toNumber()).toBe(0);
    });

    test('Weekly subscription - credit item produces negative proration factor', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'credit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'week',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-05T00:00:00.000Z'), // 4 Days = 0.5714 Weeks
            },
            isProration: true,
            currentProrationFactor: Decimal.from('-0.5714'),
            priceIntervalDuration: 604800,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 4 Days / 7 Days ≈ 0.5714 Weeks, rounds to 1 Week
      // Full period = 1 Week
      // For credit: proration_factor = -(1 / 1) = -1.0
      expect(result.items[0].prorationFactor.toNumber()).toBe(-1.0);
    });

    test('Weekly subscription - round_down mode rounds up to larger period', () => {
      const roundDownConfig: MyProrationsConfig = {
        customInterval: 'week',
        roundingMode: 'round_down',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'week',
                intervalCount: 2,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-09T12:00:00.000Z'), // 8.5 days = 1.214 weeks
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.6071'),
            priceIntervalDuration: 1209600,
          },
        ],
      };

      const result = new MyProrations().prorateItems(
        request,
        roundDownConfig,
        mockContext
      );

      // 1.214 weeks, round_down rounds UP to 2 weeks (larger period)
      // proration_factor = 2 / 2 = 1.0
      expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
    });

    test('Weekly subscription - round_up mode rounds down to smaller period', () => {
      const roundUpConfig: MyProrationsConfig = {
        customInterval: 'week',
        roundingMode: 'round_up',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'week',
                intervalCount: 2,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-12T12:00:00.000Z'), // 11.5 days = 1.643 weeks
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.8214'),
            priceIntervalDuration: 1209600,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, roundUpConfig, mockContext);

      // 1.643 weeks, round_up rounds DOWN to 1 week (smaller period)
      // proration_factor = 1 / 2 = 0.5
      expect(result.items[0].prorationFactor.toNumber()).toBe(0.5);
    });

    test('bi-weekly subscription - 1.5 Weeks out of 2 Weeks', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'week',
                intervalCount: 2,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-11T12:00:00.000Z'), // 10.5 days = 1.5 weeks
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.75'),
            priceIntervalDuration: 1209600,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 1.5 weeks rounds to 2 weeks
      // proration_factor = 2 / 2 = 1.0
      expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
    });

    test('leaves non-Week interval unchanged', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-11T12:00:00.000Z'),
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.5'),
            priceIntervalDuration: 2592000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Week granularity not compatible with Month interval, leaves as-is
      expect(result.items[0].prorationFactor.toNumber()).toBe(0.5);
      expect(result.items[0].lineItemPeriod.startDate).toEqual(
        new Date('2023-01-01T00:00:00.000Z')
      );
    });
  });

  describe('Month granularity', () => {
    const config: MyProrationsConfig = {
      customInterval: 'month',
      roundingMode: 'round_nearest',
    };

    test('Monthly subscription - 1.5 Months rounds to 2 Months', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-02-15T00:00:00.000Z'), // ~45 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('1.5'),
            priceIntervalDuration: 2592000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // ~45 Days / 30 Days per Month ≈ 1.5 Months, rounds to 2 Months
      // Adjusted start = 2023-02-15 - 2 Months = 2022-12-15
      // Actual seconds from 2022-12-15 to 2023-02-15 = 62 Days
      // Full period = 31 Days (Jan 15 to Feb 15)
      // proration_factor = 62 Days / 31 Days = 2.0
      expect(result.items[0].prorationFactor.toNumber()).toBe(2.0);
      expect(result.items[0].lineItemPeriod.startDate).toEqual(
        new Date('2022-12-15T00:00:00.000Z')
      );
    });

    test('Monthly subscription - 0.4 Months rounds to 0 Months', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-13T00:00:00.000Z'), // 12 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.4'),
            priceIntervalDuration: 2592000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 12 Days / 30 Days per Month = 0.4 Months, rounds to 0 Months
      // proration_factor = 0
      expect(result.items[0].prorationFactor.toNumber()).toBe(0);
      expect(result.items[0].lineItemPeriod.startDate).toEqual(
        new Date('2023-01-13T00:00:00.000Z')
      );
    });

    test('handles Month overflow - Jan 31 to Feb 28', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-31T13:00:00.000Z'),
              endDate: new Date('2023-02-25T02:00:00.000Z'), // ~25 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.0698'),
            priceIntervalDuration: 31536000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // ~25 Days / 30 Days ≈ 0.83 Months, rounds to 1 Month
      // Clean fraction: 1 Month out of 12 Months = 1/12 ≈ 0.0833
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(1 / 12, 4);
    });

    test('handles Month overflow - Jan 31 to Feb 29 (leap year)', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2024-01-31T13:00:00.000Z'),
              endDate: new Date('2024-02-25T02:00:00.000Z'), // ~25 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.0698'),
            priceIntervalDuration: 31536000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // ~25 Days / 30 Days ≈ 0.83 Months, rounds to 1 Month
      // Clean fraction: 1 Month out of 12 Months = 1/12 ≈ 0.0833
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(1 / 12, 4);
    });

    test('Yearly subscription - 7 Months out of 12', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-08-01T00:00:00.000Z'), // 7 Months
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.5808'),
            priceIntervalDuration: 31536000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 212 Days / 30 Days per Month ≈ 7.07 Months, rounds to 7 Months
      // Clean fraction: 7 Months out of 12 Months = 7/12 ≈ 0.5833
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(7 / 12, 4);
    });
  });

  describe('Month granularity incompatible intervals', () => {
    test('leaves item as-is when month custom interval used with day billing interval', () => {
      const config: MyProrationsConfig = {
        customInterval: 'month',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'day',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-01T12:00:00.000Z'),
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.5'),
            priceIntervalDuration: 86400,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      expect(result.items[0].prorationFactor.toNumber()).toBe(0.5);
      expect(result.items[0].lineItemPeriod.startDate).toEqual(
        new Date('2023-01-01T00:00:00.000Z')
      );
    });

    test('leaves item as-is when month custom interval used with week billing interval', () => {
      const config: MyProrationsConfig = {
        customInterval: 'month',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'week',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-05T00:00:00.000Z'),
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.5714'),
            priceIntervalDuration: 604800,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      expect(result.items[0].prorationFactor.toNumber()).toBe(0.5714);
      expect(result.items[0].lineItemPeriod.startDate).toEqual(
        new Date('2023-01-01T00:00:00.000Z')
      );
    });
  });

  describe('edge cases', () => {
    test('handles zero duration service period', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'day',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-01T00:00:00.000Z'),
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0'),
            priceIntervalDuration: 86400,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 0 Days / 1 Day = 0
      expect(result.items[0].prorationFactor.toNumber()).toBe(0);
    });

    test('exact integer days unchanged by all rounding modes', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'week',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-04T00:00:00.000Z'), // exactly 3 days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.4286'),
            priceIntervalDuration: 604800,
          },
        ],
      };

      const roundNearest: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };
      const roundDown: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_down',
      };
      const roundUp: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_up',
      };

      const resultNearest = new MyProrations().prorateItems(
        request,
        roundNearest,
        mockContext
      );
      const resultDown = new MyProrations().prorateItems(request, roundDown, mockContext);
      const resultUp = new MyProrations().prorateItems(request, roundUp, mockContext);

      // 3 / 7 ≈ 0.4286 for all rounding modes (exact integer stays the same)
      expect(resultNearest.items[0].prorationFactor.toNumber()).toBeCloseTo(3 / 7, 4);
      expect(resultDown.items[0].prorationFactor.toNumber()).toBeCloseTo(3 / 7, 4);
      expect(resultUp.items[0].prorationFactor.toNumber()).toBeCloseTo(3 / 7, 4);
    });

    test('handles multiple items with mixed credit and debit', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'debit_item',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'week',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-04T00:00:00.000Z'), // 3 days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.4286'),
            priceIntervalDuration: 604800,
          },
          {
            key: 'credit_item',
            type: 'credit',
            priceKind: 'price',
            price: {
              id: 'price_456',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_456', name: 'Old Product', metadata: {} },
              recurring: {
                interval: 'week',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-06T00:00:00.000Z'), // 5 days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('-0.7143'),
            priceIntervalDuration: 604800,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // debit: 3 / 7 ≈ 0.4286
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(3 / 7, 4);
      expect(result.items[0].key).toBe('debit_item');

      // credit: -(5 / 7) ≈ -0.7143
      expect(result.items[1].prorationFactor.toNumber()).toBeCloseTo(-5 / 7, 4);
      expect(result.items[1].key).toBe('credit_item');
    });

    test('handles multiple items with different durations', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'week',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-08T00:00:00.000Z'), // 7 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('1.0'),
            priceIntervalDuration: 604800,
          },
          {
            key: 'item_2',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_456',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-16T00:00:00.000Z'), // 15 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.5'),
            priceIntervalDuration: 2592000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // item_1: 7 Days / 7 Days = 1.0
      expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);

      // item_2: 15 Days / 31 Days ≈ 0.4839
      expect(result.items[1].prorationFactor.toNumber()).toBeCloseTo(0.4839, 4);
    });

    test('handles empty items array', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      expect(result.items).toEqual([]);
    });

    test('preserves item keys in response', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'custom_key_123',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'day',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-02T00:00:00.000Z'),
            },
            isProration: true,
            currentProrationFactor: Decimal.from('1.0'),
            priceIntervalDuration: 86400,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      expect(result.items[0].key).toBe('custom_key_123');
    });

    test('leaves item as-is when isProration is false', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'day',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T12:00:00.000Z'),
              endDate: new Date('2023-01-05T18:00:00.000Z'),
            },
            isProration: false,
            currentProrationFactor: Decimal.from('0.75'),
            priceIntervalDuration: 86400,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Should not modify non-proration items
      expect(result.items[0].prorationFactor.toNumber()).toBe(0.75);
      expect(result.items[0].lineItemPeriod.startDate).toEqual(
        new Date('2023-01-01T12:00:00.000Z')
      );
    });

    test('leaves item as-is when no recurring info or priceIntervalDuration', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-05T00:00:00.000Z'),
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.5'),
            priceIntervalDuration: 86400,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Should leave as-is when no period info available
      expect(result.items[0].prorationFactor.toNumber()).toBe(0.5);
      expect(result.items[0].lineItemPeriod.startDate).toEqual(
        new Date('2023-01-01T00:00:00.000Z')
      );
    });

    test('leaves item as-is when interval is unknown (billingPeriodUnits null)', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'custom_interval' as 'day',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-05T00:00:00.000Z'),
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.45'),
            priceIntervalDuration: 86400,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // calculateDenominatorUnits returns null for an unknown interval, so we fall back
      expect(result.items[0].prorationFactor.toNumber()).toBe(0.45);
      expect(result.items[0].lineItemPeriod.startDate).toEqual(
        new Date('2023-01-01T00:00:00.000Z')
      );
    });

    test('leaves item as-is when granularity is unknown', () => {
      const config: MyProrationsConfig = {
        customInterval: 'unknown_granularity' as MyProrationsConfig['customInterval'],
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'day',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-05T00:00:00.000Z'),
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.85'),
            priceIntervalDuration: 86400,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Should leave as-is when granularity is unknown
      expect(result.items[0].prorationFactor.toNumber()).toBe(0.85);
      expect(result.items[0].lineItemPeriod.startDate).toEqual(
        new Date('2023-01-01T00:00:00.000Z')
      );
    });
  });

  describe('leap year scenarios', () => {
    test('Day granularity - period including Feb 29th in leap year', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2024-02-20T00:00:00.000Z'),
              endDate: new Date('2024-03-05T00:00:00.000Z'), // 14 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.4667'),
            priceIntervalDuration: 2592000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Duration: 14 Days
      // Full period: 29 Days (Feb 5 to Mar 5 in leap year, Feb has 29 Days)
      // proration_factor = 14 / 29 ≈ 0.4828
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(0.4828, 4);
    });

    test('Day granularity - yearly subscription in leap year (366 Days)', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2024-01-01T00:00:00.000Z'),
              endDate: new Date('2024-07-03T00:00:00.000Z'), // 184 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.5027'),
            priceIntervalDuration: 31536000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 184 Days out of 366 Days (leap year)
      // proration_factor = 184 / 366 ≈ 0.5027
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(0.5027, 4);
    });

    test('Month granularity - period ending on Feb 29th in leap year', () => {
      const config: MyProrationsConfig = {
        customInterval: 'month',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-12-31T00:00:00.000Z'),
              endDate: new Date('2024-02-29T00:00:00.000Z'), // ~60 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.1639'),
            priceIntervalDuration: 31536000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // ~60 Days / 30 Days per Month = 2 Months
      // Clean fraction: 2 Months out of 12 Months = 2/12 ≈ 0.1667
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(2 / 12, 4);
    });
  });

  describe('Months with different Day counts', () => {
    test('Day granularity - period from January (31 Days) to February (28 Days)', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-25T00:00:00.000Z'),
              endDate: new Date('2023-02-10T00:00:00.000Z'), // 16 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.5714'),
            priceIntervalDuration: 2592000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Duration: 16 Days
      // Full period: 31 Days (Jan 10 to Feb 10, going back 1 Month from Feb 10)
      // proration_factor = 16 / 31 ≈ 0.5161
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(0.5161, 4);
    });

    test('Day granularity - period from February (28 Days) to March (31 Days)', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-02-15T00:00:00.000Z'),
              endDate: new Date('2023-03-20T00:00:00.000Z'), // 33 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('1.0645'),
            priceIntervalDuration: 2592000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Duration: 33 Days
      // Full period: 28 Days (Feb 20 to Mar 20, going back 1 Month from Mar 20, Feb has 28 Days in 2023)
      // proration_factor = 33 / 28 ≈ 1.1786
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(1.1786, 4);
    });

    test('Day granularity - period from April (30 Days) to May (31 Days)', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-04-20T00:00:00.000Z'),
              endDate: new Date('2023-05-15T00:00:00.000Z'), // 25 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.8065'),
            priceIntervalDuration: 2592000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Duration: 25 Days
      // Full period: 30 Days (Apr 15 to May 15, going back 1 Month from May 15, April has 30 Days)
      // proration_factor = 25 / 30 ≈ 0.8333
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(0.8333, 4);
    });

    test('Month granularity - period from January (31 Days) to February (28 Days)', () => {
      const config: MyProrationsConfig = {
        customInterval: 'month',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-15T00:00:00.000Z'),
              endDate: new Date('2023-02-20T00:00:00.000Z'), // 36 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.0986'),
            priceIntervalDuration: 31536000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // ~36 Days / 30 Days per Month ≈ 1.2 Months, rounds to 1 Month
      // Clean fraction: 1 Month out of 12 Months = 1/12 ≈ 0.0833
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(1 / 12, 4);
    });

    test('Month granularity - period spanning 31-Day, 30-Day, and 31-Day Months', () => {
      const config: MyProrationsConfig = {
        customInterval: 'month',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-03-15T00:00:00.000Z'),
              endDate: new Date('2023-06-10T00:00:00.000Z'), // 87 Days (Mar 31, Apr 30, May 31)
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.2384'),
            priceIntervalDuration: 31536000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 87 Days / 30 Days per Month ≈ 2.9 Months, rounds to 3 Months
      // Clean fraction: 3 Months out of 12 Months = 3/12 = 0.25
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(3 / 12, 4);
    });

    test('Month granularity - period from Feb 28 spanning into 31-Day Month', () => {
      const config: MyProrationsConfig = {
        customInterval: 'month',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-02-28T00:00:00.000Z'),
              endDate: new Date('2023-03-31T00:00:00.000Z'), // 31 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.0849'),
            priceIntervalDuration: 31536000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 31 Days / 30 Days per Month ≈ 1.03 Months, rounds to 1 Month
      // Clean fraction: 1 Month out of 12 Months = 1/12 ≈ 0.0833
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(1 / 12, 4);
    });
  });

  describe('realistic scenarios', () => {
    test('Monthly subscription with Day granularity - mid-Month cancellation', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'sub_item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_Monthly',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-03-02T12:00:00.000Z'),
              endDate: new Date('2023-03-10T16:00:00.000Z'),
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.2815'),
            priceIntervalDuration: 2592000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Duration: ~8.17 Days, rounds to 8 Days
      // Full period: 28 Days (from Mar 10 back 1 Month = Feb 10 to Mar 10, Feb has 28 Days in 2023)
      // proration_factor = 8 / 28 ≈ 0.2857
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(0.2857, 4);

      // Adjusted start should be 8 Days before end
      expect(result.items[0].lineItemPeriod.startDate).toEqual(
        new Date('2023-03-02T16:00:00.000Z')
      );
    });

    test('bi-Weekly subscription with Day granularity', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'sub_item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_biWeekly',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'week',
                intervalCount: 2,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-08T00:00:00.000Z'),
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.5'),
            priceIntervalDuration: 1209600,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Duration: 7 Days
      // Full period: 14 Days
      // proration_factor = 7 / 14 = 0.5
      expect(result.items[0].prorationFactor.toNumber()).toBe(0.5);
    });

    test('annual subscription with Month granularity - upgrade mid-year', () => {
      const config: MyProrationsConfig = {
        customInterval: 'month',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'annual_upgrade_credit',
            type: 'credit',
            priceKind: 'price',
            price: {
              id: 'price_annual',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-07-15T00:00:00.000Z'),
              endDate: new Date('2024-01-01T00:00:00.000Z'),
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.4658'),
            priceIntervalDuration: 31536000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Duration: ~170 Days / 30 Days per Month ≈ 5.67 Months, rounds to 6 Months
      // Clean fraction: 6 Months out of 12 Months = 6/12 = 0.5
      // For credit: proration_factor = -0.5
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(-6 / 12, 4);
    });
  });

  describe('rounding mode configuration', () => {
    test('round mode (default) - 1.5 Months rounds to 2 Months', () => {
      const config: MyProrationsConfig = {
        customInterval: 'month',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-02-15T00:00:00.000Z'), // ~45 Days ≈ 1.5 Months
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.1233'),
            priceIntervalDuration: 31536000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 45 Days / 30 Days = 1.5, rounds to 2 Months
      // Clean fraction: 2/12 ≈ 0.1667
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(2 / 12, 4);
    });

    test('Always round down mode - 1.9 Months rounds up to 2 Months (larger period)', () => {
      const config: MyProrationsConfig = {
        customInterval: 'month',
        roundingMode: 'round_down',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-02-28T00:00:00.000Z'), // ~58 Days ≈ 1.93 Months
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.1589'),
            priceIntervalDuration: 31536000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 58 Days / 30 Days = 1.93, Always round down rounds UP to 2 Months (larger period)
      // Clean fraction: 2/12 ≈ 0.1667
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(2 / 12, 4);
    });

    test('Always round up mode - 1.1 Months rounds down to 1 Month (smaller period)', () => {
      const config: MyProrationsConfig = {
        customInterval: 'month',
        roundingMode: 'round_up',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-02-03T00:00:00.000Z'), // ~33 Days ≈ 1.1 Months
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.0904'),
            priceIntervalDuration: 31536000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 33 Days / 30 Days = 1.1, Always round up rounds DOWN to 1 Month (smaller period)
      // Clean fraction: 1/12 ≈ 0.0833
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(1 / 12, 4);
    });

    test('Always round down mode - covers full partial Day (larger period)', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_down',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-16T23:59:59.000Z'), // 15.999... Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.5161'),
            priceIntervalDuration: 2592000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 15.999... Days, Always round down rounds UP to 16 Days (larger period)
      // Full period = 31 Days (Dec 16 to Jan 16)
      // proration_factor = 16 / 31 ≈ 0.5161
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(16 / 31, 4);
    });

    test('Always round up mode - caps to whole Days (smaller period)', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_up',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-01T00:00:01.000Z'), // 1 second of usage
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0'),
            priceIntervalDuration: 2592000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 1 second of usage, Always round up rounds DOWN to 0 full Days (smaller period)
      // Full period = 31 Days (Dec 1 to Jan 1)
      // proration_factor = 0 / 31 = 0
      expect(result.items[0].prorationFactor.toNumber()).toBe(0);
    });
  });

  describe('Hour granularity', () => {
    test('Hour granularity - 13.7 Hours rounds to 14 Hours', () => {
      const config: MyProrationsConfig = {
        customInterval: 'hour',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'day',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-01T13:42:00.000Z'), // 13.7 Hours
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.5708'),
            priceIntervalDuration: 86400,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 13.7 Hours rounds to 14 Hours
      // proration_factor = 14 / 24 ≈ 0.5833
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(14 / 24, 4);
    });

    test('Hour granularity - Monthly subscription (denominator uses calendar Days)', () => {
      const config: MyProrationsConfig = {
        customInterval: 'hour',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-31T00:00:00.000Z'), // 30 Days = 720 Hours
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.9677'),
            priceIntervalDuration: 2678400,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Numerator: round(720 Hours) = 720 Hours
      // Denominator: Jan 31 back 1 Month = Dec 31; Dec 31 → Jan 31 = 31 Days = 744 Hours
      // proration_factor = 720 / 744 ≈ 0.9677
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(720 / 744, 4);
    });

    test('Hour granularity - weekly subscription', () => {
      const config: MyProrationsConfig = {
        customInterval: 'hour',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'week',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-04T14:30:00.000Z'), // 3 days 14.5 hours = 86.5 hours
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.5149'),
            priceIntervalDuration: 604800,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 86.5 hours rounds to 87 hours
      // Full period: 7 days = 168 hours
      // proration_factor = 87 / 168 ≈ 0.5179
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(87 / 168, 4);
    });

    test('Hour granularity - round_down mode rounds up to larger period', () => {
      const config: MyProrationsConfig = {
        customInterval: 'hour',
        roundingMode: 'round_down',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'day',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-01T13:10:00.000Z'), // 13.167 hours
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.5486'),
            priceIntervalDuration: 86400,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 13.167 hours, round_down rounds UP to 14 hours (larger period)
      // proration_factor = 14 / 24 ≈ 0.5833
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(14 / 24, 4);
    });

    test('Hour granularity - round_up mode rounds down to smaller period', () => {
      const config: MyProrationsConfig = {
        customInterval: 'hour',
        roundingMode: 'round_up',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'day',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-01T13:50:00.000Z'), // 13.833 hours
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.5764'),
            priceIntervalDuration: 86400,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 13.833 hours, round_up rounds DOWN to 13 hours (smaller period)
      // proration_factor = 13 / 24 ≈ 0.5417
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(13 / 24, 4);
    });

    test('Hour granularity - credit item produces negative proration factor', () => {
      const config: MyProrationsConfig = {
        customInterval: 'hour',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'credit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'day',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-01T18:00:00.000Z'), // 18 hours
            },
            isProration: true,
            currentProrationFactor: Decimal.from('-0.75'),
            priceIntervalDuration: 86400,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 18 hours rounds to 18 hours
      // proration_factor = -(18 / 24) = -0.75
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(-18 / 24, 4);
    });

    test('Hour granularity - yearly subscription (denominator uses full calendar year)', () => {
      const config: MyProrationsConfig = {
        customInterval: 'hour',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-31T00:00:00.000Z'), // 30 Days = 720 Hours
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.0822'),
            priceIntervalDuration: 31536000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Numerator: round(720 Hours) = 720 Hours
      // Denominator: Jan 31 back 1 year = Jan 31 2022; Jan 31 2022 → Jan 31 2023 = 365 Days = 8760 Hours
      // proration_factor = 720 / 8760 = 30/365 ≈ 0.0822
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(720 / 8760, 4);
    });
  });

  describe('multi-interval subscriptions', () => {
    test('quarterly subscription (3 Months) with Month granularity - 2 out of 3 Months', () => {
      const config: MyProrationsConfig = {
        customInterval: 'month',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 3,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-03-01T00:00:00.000Z'), // ~59 Days ≈ 2 Months
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.6667'),
            priceIntervalDuration: 7776000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // ~59 Days / 30 Days ≈ 1.97, rounds to 2 Months
      // Clean fraction: 2 Months out of 3 Months = 2/3 ≈ 0.6667
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(2 / 3, 4);
    });

    test('semi-annual subscription (6 Months) with Month granularity - 4 out of 6 Months', () => {
      const config: MyProrationsConfig = {
        customInterval: 'month',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 6,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-08T00:00:00.000Z'),
              endDate: new Date('2023-05-01T00:00:00.000Z'), // ~112 Days ≈ 4 Months
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.6667'),
            priceIntervalDuration: 15552000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // ~112 Days / 30 Days = 3.7333, rounds to 4 Months
      // Clean fraction: 4 Months out of 6 Months = 4/6 ≈ 0.6667
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(4 / 6, 4);
    });

    test('2-year subscription with Month granularity - 18 out of 24 Months', () => {
      const config: MyProrationsConfig = {
        customInterval: 'month',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 2,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-08T00:00:00.000Z'),
              endDate: new Date('2024-07-01T00:00:00.000Z'), // ~540 Days ≈ 18 Months
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.75'),
            priceIntervalDuration: 63072000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // ~540 Days / 30 Days = 18 Months, rounds to 18 Months
      // Clean fraction: 18 Months out of 24 Months = 18/24 = 0.75
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(18 / 24, 4);
    });
  });

  describe('exact boundary cases with rounding modes', () => {
    test('exactly 0.5 Days - round mode rounds up to 1', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'week',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-01T12:00:00.000Z'), // Exactly 0.5 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.0714'),
            priceIntervalDuration: 604800,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Exactly 0.5 Days: Math.round(0.5) = 1 (rounds up in JavaScript)
      // proration_factor = 1 / 7 ≈ 0.1429
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(1 / 7, 4);
    });

    test('exactly 2.47 Months - Always round down mode rounds up to 3 (larger period)', () => {
      const config: MyProrationsConfig = {
        customInterval: 'month',
        roundingMode: 'round_down',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-03-16T00:00:00.000Z'), // 74 Days / 30 ≈ 2.47
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.2027'),
            priceIntervalDuration: 31536000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // ~74 Days / 30 Days = 2.47, Always round down rounds UP to 3 Months (larger period)
      // Clean fraction: 3/12 = 0.25
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(3 / 12, 4);
    });

    test('exactly 2.47 Months - Always round up mode rounds down to 2 (smaller period)', () => {
      const config: MyProrationsConfig = {
        customInterval: 'month',
        roundingMode: 'round_up',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-03-16T00:00:00.000Z'), // 74 Days / 30 ≈ 2.47
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.2027'),
            priceIntervalDuration: 31536000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // ~74 Days / 30 Days = 2.47, Always round up rounds DOWN to 2 Months (smaller period)
      // Clean fraction: 2/12 ≈ 0.1667
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(2 / 12, 4);
    });
  });

  describe('time-of-Day complexity', () => {
    test('Monthly subscription - start 9am, upgrade 5pm (8 Hours shift)', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-15T09:00:00.000Z'), // 9am
              endDate: new Date('2023-02-05T17:00:00.000Z'), // 5pm, 21.333 Days later
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.6881'),
            priceIntervalDuration: 2592000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 21.333 Days rounds to 21 Days
      // Full period: 31 Days (Jan 5 17:00 to Feb 5 17:00)
      // proration_factor = 21 / 31 ≈ 0.6774
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(21 / 31, 4);

      // Adjusted start should be 21 Days before 5pm
      expect(result.items[0].lineItemPeriod.startDate).toEqual(
        new Date('2023-01-15T17:00:00.000Z')
      );
    });

    test('crosses midnight - 23:59 to 00:01 next Day', () => {
      const config: MyProrationsConfig = {
        customInterval: 'hour',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'day',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T23:59:00.000Z'),
              endDate: new Date('2023-01-02T00:01:00.000Z'), // 2 minutes = 0.033 Hours
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.0014'),
            priceIntervalDuration: 86400,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 0.033 Hours rounds to 0 Hours
      // proration_factor = 0
      expect(result.items[0].prorationFactor.toNumber()).toBe(0);
    });
  });

  describe('credit scenarios', () => {
    test('Month granularity credit - yearly subscription downgrade', () => {
      const config: MyProrationsConfig = {
        customInterval: 'month',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'credit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-04-01T00:00:00.000Z'), // 3 Months
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.25'),
            priceIntervalDuration: 31536000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 3 Months = 3/12 = 0.25, but negative for credit
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(-3 / 12, 4);
    });

    test('Day granularity credit with Always round down mode - larger refund (larger period)', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_down',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'credit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-16T12:00:00.000Z'), // 15.5 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.5'),
            priceIntervalDuration: 2592000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 15.5 Days, Always round down rounds UP to 16 Days (larger period → larger refund)
      // Full period = 31 Days
      // For credit: -(16 / 31) ≈ -0.5161
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(-16 / 31, 4);
    });

    test('Day granularity credit with correspondingDebit - denominator uses debit period', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'credit_plan_b',
            type: 'credit',
            priceKind: 'price',
            price: {
              id: 'price_plan_b',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Plan B', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-20T00:00:00.000Z'),
              endDate: new Date('2023-02-01T00:00:00.000Z'), // 12 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('-0.3871'),
            priceIntervalDuration: 2678400,
            correspondingDebit: {
              servicePeriod: {
                startDate: new Date('2023-01-10T00:00:00.000Z'),
                endDate: new Date('2023-02-01T00:00:00.000Z'), // 22 Days
              },
            },
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Credit numerator: round(12 Days) = 12
      // Debit denominator: round(22 Days) = 22
      // proration_factor = -(12 / 22) ≈ -0.5455
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(-12 / 22, 4);
    });

    test('Month granularity credit with correspondingDebit - denominator uses rounded debit Months', () => {
      const config: MyProrationsConfig = {
        customInterval: 'month',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'credit_plan_b',
            type: 'credit',
            priceKind: 'price',
            price: {
              id: 'price_plan_b',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Plan B', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-05-01T00:00:00.000Z'),
              endDate: new Date('2024-01-01T00:00:00.000Z'), // ~245 Days ≈ 8.17 Months
            },
            isProration: true,
            currentProrationFactor: Decimal.from('-0.6667'),
            priceIntervalDuration: 31536000,
            correspondingDebit: {
              servicePeriod: {
                startDate: new Date('2023-02-01T00:00:00.000Z'),
                endDate: new Date('2024-01-01T00:00:00.000Z'), // ~334 Days ≈ 11.13 Months
              },
            },
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Credit numerator: round(245 / 30) = round(8.17) = 8 Months
      // Debit denominator: round(334 / 30) = round(11.13) = 11 Months
      // proration_factor = -(8 / 11) ≈ -0.7273
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(-8 / 11, 4);
    });

    test('credit without correspondingDebit falls back to billing period denominator', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'credit_no_debit',
            type: 'credit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-20T00:00:00.000Z'),
              endDate: new Date('2023-02-01T00:00:00.000Z'), // 12 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('-0.3871'),
            priceIntervalDuration: 2678400,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // No correspondingDebit: denominator = full billing period (Jan = 31 Days)
      // proration_factor = -(12 / 31) ≈ -0.3871
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(-12 / 31, 4);
    });

    test('Day granularity credit with correspondingDebit + Always round down mode - rounds both numerator and denominator up', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_down',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'credit_plan_b',
            type: 'credit',
            priceKind: 'price',
            price: {
              id: 'price_plan_b',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Plan B', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-20T00:00:00.000Z'),
              endDate: new Date('2023-02-01T12:00:00.000Z'), // 12.5 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('-0.4032'),
            priceIntervalDuration: 2678400,
            correspondingDebit: {
              servicePeriod: {
                startDate: new Date('2023-01-10T00:00:00.000Z'),
                endDate: new Date('2023-02-01T12:00:00.000Z'), // 22.5 Days
              },
            },
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Credit numerator: Math.ceil(12.5) = 13 (Always round down rounds UP → larger period)
      // Debit denominator: Math.ceil(22.5) = 23 (Always round down rounds UP → larger period)
      // proration_factor = -(13 / 23) ≈ -0.5652
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(-13 / 23, 4);
    });

    test('Day granularity credit with correspondingDebit + Always round up mode - rounds both numerator and denominator down', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_up',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'credit_plan_b',
            type: 'credit',
            priceKind: 'price',
            price: {
              id: 'price_plan_b',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Plan B', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-20T00:00:00.000Z'),
              endDate: new Date('2023-02-01T12:00:00.000Z'), // 12.5 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('-0.4032'),
            priceIntervalDuration: 2678400,
            correspondingDebit: {
              servicePeriod: {
                startDate: new Date('2023-01-10T00:00:00.000Z'),
                endDate: new Date('2023-02-01T12:00:00.000Z'), // 22.5 Days
              },
            },
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Credit numerator: Math.floor(12.5) = 12 (Always round up rounds DOWN → smaller period)
      // Debit denominator: Math.floor(22.5) = 22 (Always round up rounds DOWN → smaller period)
      // proration_factor = -(12 / 22) ≈ -0.5455
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(-12 / 22, 4);
    });

    test('Hour granularity credit with correspondingDebit - denominator uses debit period in hours', () => {
      const config: MyProrationsConfig = {
        customInterval: 'hour',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'credit_hourly',
            type: 'credit',
            priceKind: 'price',
            price: {
              id: 'price_hourly',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Hourly Plan', metadata: {} },
              recurring: {
                interval: 'day',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T14:00:00.000Z'),
              endDate: new Date('2023-01-01T20:00:00.000Z'), // 6 hours
            },
            isProration: true,
            currentProrationFactor: Decimal.from('-0.25'),
            priceIntervalDuration: 86400,
            correspondingDebit: {
              servicePeriod: {
                startDate: new Date('2023-01-01T08:00:00.000Z'),
                endDate: new Date('2023-01-01T20:00:00.000Z'), // 12 hours
              },
            },
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Credit numerator: round(6 hours) = 6
      // Debit denominator: round(12 hours) = 12
      // proration_factor = -(6 / 12) = -0.5
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(-6 / 12, 4);
    });

    test('Month granularity credit with correspondingDebit + round_down mode', () => {
      const config: MyProrationsConfig = {
        customInterval: 'month',
        roundingMode: 'round_down',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'credit_monthly_rd',
            type: 'credit',
            priceKind: 'price',
            price: {
              id: 'price_yearly',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Yearly Plan', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-06-01T00:00:00.000Z'),
              endDate: new Date('2024-01-01T00:00:00.000Z'), // 7 months
            },
            isProration: true,
            currentProrationFactor: Decimal.from('-0.5833'),
            priceIntervalDuration: 31536000,
            correspondingDebit: {
              servicePeriod: {
                startDate: new Date('2023-02-15T00:00:00.000Z'),
                endDate: new Date('2024-01-01T00:00:00.000Z'), // ~10.5 months
              },
            },
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Credit numerator: 7 months exact → round_down (ceil) = 7
      // Debit denominator: ~10.5 months → round_down (ceil) = 11
      // proration_factor = -(7 / 11) ≈ -0.6364
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(-7 / 11, 4);
    });

    test('Month granularity credit with correspondingDebit + round_up mode', () => {
      const config: MyProrationsConfig = {
        customInterval: 'month',
        roundingMode: 'round_up',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'credit_monthly_ru',
            type: 'credit',
            priceKind: 'price',
            price: {
              id: 'price_yearly',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Yearly Plan', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-06-01T00:00:00.000Z'),
              endDate: new Date('2024-01-01T00:00:00.000Z'), // 7 months
            },
            isProration: true,
            currentProrationFactor: Decimal.from('-0.5833'),
            priceIntervalDuration: 31536000,
            correspondingDebit: {
              servicePeriod: {
                startDate: new Date('2023-02-15T00:00:00.000Z'),
                endDate: new Date('2024-01-01T00:00:00.000Z'), // ~10.5 months
              },
            },
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Credit numerator: 7 months exact → round_up (floor) = 7
      // Debit denominator: ~10.5 months → round_up (floor) = 10
      // proration_factor = -(7 / 10) = -0.7
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(-7 / 10, 4);
    });

    test('credit with zero-duration correspondingDebit falls back to prorationFactor of -1', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'credit_zero_debit',
            type: 'credit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'month',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-10T00:00:00.000Z'),
              endDate: new Date('2023-01-20T00:00:00.000Z'), // 10 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('-0.5'),
            priceIntervalDuration: 2678400,
            correspondingDebit: {
              servicePeriod: {
                startDate: new Date('2023-01-10T00:00:00.000Z'),
                endDate: new Date('2023-01-10T00:00:00.000Z'),
              },
            },
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // debitTimeDiffMs = 0 → rawDebitUnits = 0 → denominatorUnits = 0
      // denominatorUnits > 0 guard fires → proration_factor = 1.0, negated to -1.0 for credit
      expect(result.items[0].prorationFactor.toNumber()).toBe(-1.0);
    });
  });

  describe('near-complete periods', () => {
    test('11.9 Months rounds to 12 Months - full year charge', () => {
      const config: MyProrationsConfig = {
        customInterval: 'month',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-12-27T00:00:00.000Z'), // 360 Days ≈ 11.84 Months
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.9863'),
            priceIntervalDuration: 31536000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // ~360 Days / 30 Days = 12 Months (rounds to 12)
      // Clean fraction: 12/12 = 1.0 (full year!)
      expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
    });

    test('6.9 Days out of 7 - almost full Week', () => {
      const config: MyProrationsConfig = {
        customInterval: 'day',
        roundingMode: 'round_nearest',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_123',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: { id: 'prod_123', name: 'Test Product', metadata: {} },
              recurring: {
                interval: 'week',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-07T21:36:00.000Z'), // 6.9 Days
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.9857'),
            priceIntervalDuration: 604800,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 6.9 Days rounds to 7 Days (full Week!)
      // proration_factor = 7 / 7 = 1.0
      expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
    });

    test('yearly subscription - 364-day period (Jan 16 → Jan 15) snaps to 12 months with always round down', () => {
      const config: MyProrationsConfig = {
        customInterval: 'month',
        roundingMode: 'round_down',
      };

      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'ubi_8JChBsjL45',
            type: 'debit',
            priceKind: 'price',
            price: {
              id: 'price_yearly_10',
              metadata: {},
              billingScheme: 'per_unit',
              type: 'recurring',
              currency: 'usd',
              product: {
                id: 'prod_yearly_10',
                name: '$10 yearly product',
                metadata: {},
              },
              recurring: {
                interval: 'year',
                intervalCount: 1,
              },
              tiers: [],
            },
            servicePeriod: {
              startDate: new Date('2026-01-16T08:00:00.000Z'),
              endDate: new Date('2027-01-15T08:00:00.000Z'), // 364 days, one day short of a full year
            },
            isProration: true,
            currentProrationFactor: Decimal.from('0.9972602739726028'),
            priceIntervalDuration: 31536000,
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Calendar months: 11 + 30/31 ≈ 11.968 → Math.ceil = 12
      // proration_factor = 12/12 = 1.0
      expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
      expect(result.items[0].lineItemPeriod.endDate).toEqual(
        new Date('2027-01-15T08:00:00.000Z')
      );
      // 12 calendar months before Jan 15 2027 = Jan 15 2026 (not Dec 15 2025)
      expect(result.items[0].lineItemPeriod.startDate).toEqual(
        new Date('2026-01-15T08:00:00.000Z')
      );
    });
  });
});

describe('licenseFee priceKind', () => {
  const mockContext: Context = {
    type: 'script',
    id: 'script_test123',
    livemode: false,
    stripeContext: 'acct_test123',
    clockTime: '2023-01-01T00:00:00Z',
  };

  const makeLicenseFeeItem = (
    serviceInterval: 'day' | 'week' | 'month' | 'year',
    serviceIntervalCount: number,
    servicePeriod: { startDate: Date; endDate: Date },
    overrides: Record<string, unknown> = {}
  ): Billing.Prorations.ProratableItem => ({
    key: 'item_1',
    type: 'debit',
    priceKind: 'licenseFee',
    licenseFee: {
      id: 'lf_123',
      metadata: {},
      serviceInterval,
      serviceIntervalCount,
      tiers: [],
      currency: 'usd',
    },
    servicePeriod,
    isProration: true,
    currentProrationFactor: Decimal.from(0.5),
    priceIntervalDuration: 2592000,
    ...overrides,
  });

  describe('DAY granularity with licenseFee', () => {
    const config: MyProrationsConfig = {
      customInterval: 'day',
      roundingMode: 'round_nearest',
    };

    test('monthly licenseFee — partial month in days', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          makeLicenseFeeItem('month', 1, {
            startDate: new Date('2023-01-01T00:00:00.000Z'),
            endDate: new Date('2023-01-16T00:00:00.000Z'),
          }),
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 15 days out of 31 (January)
      // denominator = full month ms / day ms = 31
      // numerator = 15 days → rounds to 15
      // proration_factor = 15/31 ≈ 0.4839
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(0.4839, 3);
    });

    test('yearly licenseFee — partial year in days', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          makeLicenseFeeItem('year', 1, {
            startDate: new Date('2023-01-01T00:00:00.000Z'),
            endDate: new Date('2023-02-01T00:00:00.000Z'),
          }),
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 31 days out of 365 (2023 is not a leap year)
      // proration_factor = 31/365 ≈ 0.0849
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(0.0849, 3);
    });

    test('weekly licenseFee — partial week in days', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          makeLicenseFeeItem('week', 1, {
            startDate: new Date('2023-01-01T00:00:00.000Z'),
            endDate: new Date('2023-01-04T00:00:00.000Z'),
          }),
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 3 days out of 7
      // proration_factor = 3/7 ≈ 0.4286
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(0.4286, 3);
    });
  });

  describe('MONTH granularity with licenseFee', () => {
    const config: MyProrationsConfig = {
      customInterval: 'month',
      roundingMode: 'round_nearest',
    };

    test('yearly licenseFee — partial year in months', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          makeLicenseFeeItem('year', 1, {
            startDate: new Date('2023-01-15T00:00:00.000Z'),
            endDate: new Date('2023-08-15T00:00:00.000Z'),
          }),
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 7 months out of 12
      // proration_factor = 7/12 ≈ 0.5833
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(0.5833, 3);
    });
  });

  describe('WEEK granularity with licenseFee', () => {
    const config: MyProrationsConfig = {
      customInterval: 'week',
      roundingMode: 'round_nearest',
    };

    test('weekly licenseFee — compatible, partial week', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          makeLicenseFeeItem('week', 2, {
            startDate: new Date('2023-01-01T00:00:00.000Z'),
            endDate: new Date('2023-01-11T00:00:00.000Z'),
          }),
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // 10 days = 1.4286 weeks → rounds to 1 week
      // denominator = 14 days / 7 = 2 weeks
      // proration_factor = 1/2 = 0.5
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(0.5, 4);
    });

    test('monthly licenseFee — incompatible, preserves original factor', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          makeLicenseFeeItem('month', 1, {
            startDate: new Date('2023-01-01T00:00:00.000Z'),
            endDate: new Date('2023-01-15T00:00:00.000Z'),
          }),
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // Week granularity is not compatible with monthly interval
      expect(result.items[0].prorationFactor.toNumber()).toBe(0.5);
    });
  });

  describe('credit licenseFee items', () => {
    const config: MyProrationsConfig = {
      customInterval: 'day',
      roundingMode: 'round_nearest',
    };

    test('credit licenseFee with correspondingDebit', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          {
            key: 'item_1',
            type: 'credit',
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
              startDate: new Date('2023-01-10T00:00:00.000Z'),
              endDate: new Date('2023-01-20T00:00:00.000Z'),
            },
            isProration: true,
            currentProrationFactor: Decimal.from(-0.5),
            priceIntervalDuration: 2592000,
            correspondingDebit: {
              servicePeriod: {
                startDate: new Date('2023-01-01T00:00:00.000Z'),
                endDate: new Date('2023-01-25T00:00:00.000Z'),
              },
            },
          },
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      // credit numerator: 10 days → rounds to 10
      // credit denominator: debit period = 24 days → rounds to 24
      // proration_factor = -(10/24) ≈ -0.4167
      expect(result.items[0].prorationFactor.toNumber()).toBeCloseTo(-0.4167, 3);
    });
  });

  describe('non-proration licenseFee items', () => {
    const config: MyProrationsConfig = {
      customInterval: 'day',
      roundingMode: 'round_nearest',
    };

    test('preserves original factor when isProration is false', () => {
      const request: Billing.Prorations.ProrateItemsInput = {
        items: [
          makeLicenseFeeItem(
            'month',
            1,
            {
              startDate: new Date('2023-01-01T00:00:00.000Z'),
              endDate: new Date('2023-01-15T00:00:00.000Z'),
            },
            { isProration: false, currentProrationFactor: Decimal.from(1.0) }
          ),
        ],
      };

      const result = new MyProrations().prorateItems(request, config, mockContext);

      expect(result.items[0].prorationFactor.toNumber()).toBe(1.0);
    });
  });
});

describe('non-recurring priceKind items', () => {
  const mockContext: Context = {
    type: 'script',
    id: 'script_test123',
    livemode: false,
    stripeContext: 'acct_test123',
    clockTime: '2023-01-01T00:00:00Z',
  };

  const config: MyProrationsConfig = {
    customInterval: 'day',
    roundingMode: 'round_nearest',
  };

  test('preserves original factor for rateCardRate priceKind', () => {
    const request: Billing.Prorations.ProrateItemsInput = {
      items: [
        {
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
        },
      ],
    };

    const result = new MyProrations().prorateItems(request, config, mockContext);

    expect(result.items[0].prorationFactor.toNumber()).toBe(0.5);
    expect(result.items[0].lineItemPeriod).toEqual(request.items[0].servicePeriod);
  });

  test('preserves original factor for customPricingUnitOverageRate priceKind', () => {
    const request: Billing.Prorations.ProrateItemsInput = {
      items: [
        {
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
        },
      ],
    };

    const result = new MyProrations().prorateItems(request, config, mockContext);

    expect(result.items[0].prorationFactor.toNumber()).toBe(0.5);
    expect(result.items[0].lineItemPeriod).toEqual(request.items[0].servicePeriod);
  });

  test('preserves original factor for other priceKind', () => {
    const request: Billing.Prorations.ProrateItemsInput = {
      items: [
        {
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
        },
      ],
    };

    const result = new MyProrations().prorateItems(request, config, mockContext);

    expect(result.items[0].prorationFactor.toNumber()).toBe(0.5);
    expect(result.items[0].lineItemPeriod).toEqual(request.items[0].servicePeriod);
  });

  test('preserves original factor for price without recurring field', () => {
    const request: Billing.Prorations.ProrateItemsInput = {
      items: [
        {
          key: 'item_1',
          type: 'debit',
          priceKind: 'price',
          price: {
            id: 'price_123',
            metadata: {},
            product: { id: 'prod_123', name: 'Test Product', metadata: {} },
            billingScheme: 'per_unit',
            type: 'one_time',
            currency: 'usd',
            tiers: [],
          },
          servicePeriod: {
            startDate: new Date('2023-01-01T00:00:00.000Z'),
            endDate: new Date('2023-01-15T00:00:00.000Z'),
          },
          isProration: true,
          currentProrationFactor: Decimal.from(0.5),
          priceIntervalDuration: 2592000,
        },
      ],
    };

    const result = new MyProrations().prorateItems(request, config, mockContext);

    expect(result.items[0].prorationFactor.toNumber()).toBe(0.5);
    expect(result.items[0].lineItemPeriod).toEqual(request.items[0].servicePeriod);
  });
});
