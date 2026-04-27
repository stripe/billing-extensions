import type { Billing, Context } from '@stripe/extensibility-sdk/extensions';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SeparateInvoiceForMeteredItemsConfig extends Record<string, unknown> {}

/** Rate-card and custom unit overage rates are metered/usage-style for grouping; licensed otherwise. */
function isMeteredPriceUnion(item: Billing.RecurringBillingItemHandling.Item): boolean {
  switch (item.priceKind) {
    case 'rateCardRate':
    case 'customPricingUnitOverageRate':
      return true;
    case 'price':
      return item.price.recurring?.usageType === 'metered';
    case 'licenseFee':
      return false;
    default:
      return false;
  }
}

export default class SeparateInvoiceForMeteredItems implements Billing.RecurringBillingItemHandling<SeparateInvoiceForMeteredItemsConfig> {
  beforeItemCreation(
    input: Billing.RecurringBillingItemHandling.BeforeItemCreationInput,
    _config: SeparateInvoiceForMeteredItemsConfig,
    _context: Context
  ): Billing.RecurringBillingItemHandling.BeforeItemCreationResult {
    return {
      items: input.items.map((item) => ({
        key: item.key,
        creationStrategy: 'invoice',
      })),
    };
  }

  filterItems(
    input: Billing.RecurringBillingItemHandling.FilterItemsInput,
    _config: SeparateInvoiceForMeteredItemsConfig,
    _context: Context
  ): Billing.RecurringBillingItemHandling.FilterItemsResult {
    return {
      items: input.items.map((item) => ({
        key: item.key,
      })),
    };
  }

  groupItems(
    input: Billing.RecurringBillingItemHandling.GroupItemsInput,
    _config: SeparateInvoiceForMeteredItemsConfig,
    _context: Context
  ): Billing.RecurringBillingItemHandling.GroupItemsResult {
    const licensedItems: Array<{ key: string }> = [];
    const meteredItems: Array<{ key: string }> = [];

    for (const item of input.items) {
      const isMetered = isMeteredPriceUnion(item);

      if (isMetered) {
        meteredItems.push({ key: item.key });
      } else {
        licensedItems.push({ key: item.key });
      }
    }

    const groups: Billing.RecurringBillingItemHandling.ItemGroup[] = [];
    if (licensedItems.length > 0) {
      groups.push({
        items: licensedItems,
        setsLatestInvoice: true,
      });
    }
    if (meteredItems.length > 0) {
      groups.push({
        items: meteredItems,
        setsLatestInvoice: licensedItems.length === 0,
      });
    }

    return { groups };
  }
}
