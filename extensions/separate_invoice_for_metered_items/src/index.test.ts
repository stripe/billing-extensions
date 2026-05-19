import { describe, test, expect } from 'vitest';
import type { Billing, Context } from '@stripe/extensibility-sdk/extensions';
import { Decimal } from '@stripe/extensibility-sdk';

import SeparateInvoiceForMeteredItems, {
  type SeparateInvoiceForMeteredItemsConfig,
} from './index.js';

const mockContext: Context = {
  type: 'script',
  id: 'script_test123',
  livemode: false,
  stripeContext: 'acct_test123',
  clockTime: '2023-01-01T00:00:00Z',
};

const config: SeparateInvoiceForMeteredItemsConfig = {};

const makeProduct = (): Billing.RecurringBillingItemHandling.Product => ({
  id: 'prod_test',
  name: 'Test Product',
  metadata: {},
});

const makeRecurring = (
  usageType: Billing.RecurringBillingItemHandling.UsageType
): Billing.RecurringBillingItemHandling.RecurringPrice => ({
  interval: 'month',
  intervalCount: 1,
  usageType: usageType,
});

type PricePriceUnion = {
  priceKind: 'price';
  price: Billing.RecurringBillingItemHandling.Price;
};

const makePriceWithUsageType = (
  usageType: Billing.RecurringBillingItemHandling.UsageType
): PricePriceUnion => ({
  priceKind: 'price',
  price: {
    id: 'price_test',
    metadata: {},
    product: makeProduct(),
    recurring: makeRecurring(usageType),
    billingScheme: 'per_unit',
    tiers: [],
    type: 'recurring',
    currency: 'usd',
  },
});

const makePriceWithoutRecurring = (): PricePriceUnion => ({
  priceKind: 'price',
  price: {
    id: 'price_test',
    metadata: {},
    product: makeProduct(),
    billingScheme: 'per_unit',
    tiers: [],
    type: 'one_time',
    currency: 'usd',
  },
});

type RateCardRatePriceUnion = {
  priceKind: 'rateCardRate';
  rateCardRate: Billing.RecurringBillingItemHandling.RateCardRate;
};

const makeRateCardRatePrice = (): RateCardRatePriceUnion => ({
  priceKind: 'rateCardRate',
  rateCardRate: {
    id: 'rcr_test',
    metadata: {},
    rateCard: {
      id: 'rc_test',
      currency: 'usd',
    },
    tieringMode: 'graduated',
    tiers: [],
  },
});

type LicenseFeePriceUnion = {
  priceKind: 'licenseFee';
  licenseFee: Billing.RecurringBillingItemHandling.LicenseFee;
};

const makeLicenseFeePrice = (): LicenseFeePriceUnion => ({
  priceKind: 'licenseFee',
  licenseFee: {
    id: 'lf_test',
    metadata: {},
    lookupKey: 'lk_test',
    serviceInterval: 'month',
    serviceIntervalCount: 1,
    tieringMode: 'graduated',
    tiers: [],
    currency: 'usd',
  },
});

type CustomOveragePriceUnion = {
  priceKind: 'customPricingUnitOverageRate';
  customPricingUnitOverageRate: Billing.RecurringBillingItemHandling.CustomPricingUnitOverageRate;
};

const makeCustomOveragePrice = (): CustomOveragePriceUnion => ({
  priceKind: 'customPricingUnitOverageRate',
  customPricingUnitOverageRate: {
    id: 'cpuor_test',
    metadata: {},
    rateCard: {
      id: 'rc_test',
      currency: 'usd',
    },
    customPricingUnit: 'cpu_test',
    unitAmount: Decimal.from(50),
  },
});

type PriceUnion =
  | PricePriceUnion
  | RateCardRatePriceUnion
  | LicenseFeePriceUnion
  | CustomOveragePriceUnion;

const makeItem = (
  key: string,
  priceUnion: PriceUnion
): Billing.RecurringBillingItemHandling.Item => ({
  ...priceUnion,
  key,
  type: 'debit',
  isProration: false,
  servicePeriod: {
    value: 'timeRange',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-02-01'),
  },
  prorationFactor: Decimal.from(1.0),
});

describe('meteredLicensedInvoiceSplitter', () => {
  describe('filterItems', () => {
    test('returns all items', () => {
      const input: Billing.RecurringBillingItemHandling.FilterItemsInput = {
        items: [
          makeItem('item_1', makePriceWithUsageType('metered')),
          makeItem('item_2', makePriceWithUsageType('licensed')),
        ],
      };

      const result = new SeparateInvoiceForMeteredItems().filterItems(
        input,
        config,
        mockContext
      );

      expect(result).toEqual({
        items: [{ key: 'item_1' }, { key: 'item_2' }],
      });
    });
  });

  describe('groupItems', () => {
    test('groups only metered items with setsLatestInvoice=true', () => {
      const input: Billing.RecurringBillingItemHandling.GroupItemsInput = {
        items: [makeItem('item_1', makePriceWithUsageType('metered'))],
      };

      const result = new SeparateInvoiceForMeteredItems().groupItems(
        input,
        config,
        mockContext
      );

      expect(result).toEqual({
        groups: [
          {
            items: [{ key: 'item_1' }],
            setsLatestInvoice: true,
          },
        ],
      });
    });

    test('groups multiple metered items together with setsLatestInvoice=true when no licensed items', () => {
      const input: Billing.RecurringBillingItemHandling.GroupItemsInput = {
        items: [
          makeItem('item_metered_1', makePriceWithUsageType('metered')),
          makeItem('item_metered_2', makePriceWithUsageType('metered')),
        ],
      };

      const result = new SeparateInvoiceForMeteredItems().groupItems(
        input,
        config,
        mockContext
      );

      expect(result).toEqual({
        groups: [
          {
            items: [{ key: 'item_metered_1' }, { key: 'item_metered_2' }],
            setsLatestInvoice: true,
          },
        ],
      });
    });

    test('groups licensed items with setsLatestInvoice=true', () => {
      const input: Billing.RecurringBillingItemHandling.GroupItemsInput = {
        items: [makeItem('item_1', makePriceWithUsageType('licensed'))],
      };

      const result = new SeparateInvoiceForMeteredItems().groupItems(
        input,
        config,
        mockContext
      );

      expect(result).toEqual({
        groups: [
          {
            items: [{ key: 'item_1' }],
            setsLatestInvoice: true,
          },
        ],
      });
    });

    test('groups items without recurring with setsLatestInvoice=true', () => {
      const input: Billing.RecurringBillingItemHandling.GroupItemsInput = {
        items: [makeItem('item_1', makePriceWithoutRecurring())],
      };

      const result = new SeparateInvoiceForMeteredItems().groupItems(
        input,
        config,
        mockContext
      );

      expect(result).toEqual({
        groups: [
          {
            items: [{ key: 'item_1' }],
            setsLatestInvoice: true,
          },
        ],
      });
    });

    test('groups rateCardRate as metered with setsLatestInvoice=true when no licensed items', () => {
      const input: Billing.RecurringBillingItemHandling.GroupItemsInput = {
        items: [makeItem('item_1', makeRateCardRatePrice())],
      };
      const result = new SeparateInvoiceForMeteredItems().groupItems(
        input,
        config,
        mockContext
      );

      expect(result).toEqual({
        groups: [
          {
            items: [{ key: 'item_1' }],
            setsLatestInvoice: true,
          },
        ],
      });
    });

    test('groups rateCardRate into metered group with setsLatestInvoice=false when licensed items exist', () => {
      const input: Billing.RecurringBillingItemHandling.GroupItemsInput = {
        items: [
          makeItem('item_rcr', makeRateCardRatePrice()),
          makeItem('item_licensed', makePriceWithUsageType('licensed')),
        ],
      };
      const result = new SeparateInvoiceForMeteredItems().groupItems(
        input,
        config,
        mockContext
      );

      expect(result).toEqual({
        groups: [
          {
            items: [{ key: 'item_licensed' }],
            setsLatestInvoice: true,
          },
          {
            items: [{ key: 'item_rcr' }],
            setsLatestInvoice: false,
          },
        ],
      });
    });

    test('groups customPricingUnitOverageRate as metered with setsLatestInvoice=true when no licensed items', () => {
      const input: Billing.RecurringBillingItemHandling.GroupItemsInput = {
        items: [makeItem('item_1', makeCustomOveragePrice())],
      };
      const result = new SeparateInvoiceForMeteredItems().groupItems(
        input,
        config,
        mockContext
      );

      expect(result).toEqual({
        groups: [
          {
            items: [{ key: 'item_1' }],
            setsLatestInvoice: true,
          },
        ],
      });
    });

    test('groups customPricingUnitOverageRate into metered group with setsLatestInvoice=false when licensed items exist', () => {
      const input: Billing.RecurringBillingItemHandling.GroupItemsInput = {
        items: [
          makeItem('item_overage', makeCustomOveragePrice()),
          makeItem('item_licensed', makePriceWithUsageType('licensed')),
        ],
      };
      const result = new SeparateInvoiceForMeteredItems().groupItems(
        input,
        config,
        mockContext
      );

      expect(result).toEqual({
        groups: [
          {
            items: [{ key: 'item_licensed' }],
            setsLatestInvoice: true,
          },
          {
            items: [{ key: 'item_overage' }],
            setsLatestInvoice: false,
          },
        ],
      });
    });

    test('groups other/unknown priceKind as licensed', () => {
      const otherItem: Billing.RecurringBillingItemHandling.Item = {
        key: 'item_other',
        type: 'debit',
        priceKind: 'other',
        otherPriceKind: 'some_future_type',
        isProration: false,
        servicePeriod: {
          value: 'timeRange',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-02-01'),
        },
        prorationFactor: Decimal.from(1.0),
      };
      const input: Billing.RecurringBillingItemHandling.GroupItemsInput = {
        items: [otherItem, makeItem('item_metered', makePriceWithUsageType('metered'))],
      };
      const result = new SeparateInvoiceForMeteredItems().groupItems(
        input,
        config,
        mockContext
      );

      expect(result).toEqual({
        groups: [
          {
            items: [{ key: 'item_other' }],
            setsLatestInvoice: true,
          },
          {
            items: [{ key: 'item_metered' }],
            setsLatestInvoice: false,
          },
        ],
      });
    });

    test('groups license_fee items as licensed with setsLatestInvoice=true', () => {
      const input: Billing.RecurringBillingItemHandling.GroupItemsInput = {
        items: [makeItem('item_lf_1', makeLicenseFeePrice())],
      };

      const result = new SeparateInvoiceForMeteredItems().groupItems(
        input,
        config,
        mockContext
      );

      expect(result).toEqual({
        groups: [
          {
            items: [{ key: 'item_lf_1' }],
            setsLatestInvoice: true,
          },
        ],
      });
    });

    test('splits license_fee (licensed) and rate_card_rate (metered) items into separate groups', () => {
      const input: Billing.RecurringBillingItemHandling.GroupItemsInput = {
        items: [
          makeItem('item_lf_1', makeLicenseFeePrice()),
          makeItem('item_rcr_1', makeRateCardRatePrice()),
        ],
      };

      const result = new SeparateInvoiceForMeteredItems().groupItems(
        input,
        config,
        mockContext
      );

      expect(result).toEqual({
        groups: [
          {
            items: [{ key: 'item_lf_1' }],
            setsLatestInvoice: true,
          },
          {
            items: [{ key: 'item_rcr_1' }],
            setsLatestInvoice: false,
          },
        ],
      });
    });

    test('splits mixed metered and licensed items into separate groups', () => {
      const input: Billing.RecurringBillingItemHandling.GroupItemsInput = {
        items: [
          makeItem('item_metered_1', makePriceWithUsageType('metered')),
          makeItem('item_licensed_1', makePriceWithUsageType('licensed')),
          makeItem('item_metered_2', makePriceWithUsageType('metered')),
          makeItem('item_licensed_2', makePriceWithUsageType('licensed')),
        ],
      };

      const result = new SeparateInvoiceForMeteredItems().groupItems(
        input,
        config,
        mockContext
      );

      expect(result).toEqual({
        groups: [
          {
            items: [{ key: 'item_licensed_1' }, { key: 'item_licensed_2' }],
            setsLatestInvoice: true,
          },
          {
            items: [{ key: 'item_metered_1' }, { key: 'item_metered_2' }],
            setsLatestInvoice: false,
          },
        ],
      });
    });
  });

  describe('beforeItemCreation', () => {
    test('assigns all items to invoice creation strategy', () => {
      const input: Billing.RecurringBillingItemHandling.BeforeItemCreationInput = {
        items: [
          makeItem('item_1', makePriceWithUsageType('metered')),
          makeItem('item_2', makePriceWithUsageType('licensed')),
        ],
      };

      const result = new SeparateInvoiceForMeteredItems().beforeItemCreation(
        input,
        config,
        mockContext
      );

      expect(result).toEqual({
        items: [
          {
            key: 'item_1',
            creationStrategy: 'invoice',
          },
          {
            key: 'item_2',
            creationStrategy: 'invoice',
          },
        ],
      });
    });
  });
});
