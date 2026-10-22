import { type Billing, type Context } from '@stripe/extensibility-sdk';

export interface MetadataMatcher {
  key: string;
  value: string;
}

export interface RemoveZeroQuantityMeteredItemsBeforeCreationConfig extends Record<
  string,
  unknown
> {
  /**
   * When set, only zero-quantity metered items whose Product metadata matches are skipped.
   * Leave unset to skip every zero-quantity metered item.
   * @displayName Product metadata
   */
  metadataMatcher?: MetadataMatcher;
}

function isMeteredItem(item: Billing.RecurringBillingItemHandling.Item): boolean {
  switch (item.priceKind) {
    case 'rateCardRate':
    case 'customPricingUnitOverageRate':
      return true;
    case 'price':
      return item.price.recurring?.usageType === 'metered';
    default:
      return false;
  }
}

function matchesMetadata(
  item: Billing.RecurringBillingItemHandling.Item,
  matcher: MetadataMatcher
): boolean {
  if (item.priceKind !== 'price') {
    return false;
  }

  const value = item.price.product.metadata[matcher.key];
  return (
    value !== undefined &&
    value.trim().toLowerCase() === matcher.value.trim().toLowerCase()
  );
}

export default class RemoveZeroQuantityMeteredItemsBeforeCreation implements Billing.RecurringBillingItemHandling<RemoveZeroQuantityMeteredItemsBeforeCreationConfig> {
  beforeItemCreation(
    input: Billing.RecurringBillingItemHandling.BeforeItemCreationInput,
    config: RemoveZeroQuantityMeteredItemsBeforeCreationConfig,
    _context: Context
  ): Billing.RecurringBillingItemHandling.BeforeItemCreationResult {
    return {
      items: input.items.map((item) => ({
        key: item.key,
        creationStrategy:
          item.quantity.isZero() &&
          isMeteredItem(item) &&
          (!config.metadataMatcher || matchesMetadata(item, config.metadataMatcher))
            ? 'doNotCreate'
            : 'invoice',
      })),
    };
  }

  filterItems(
    input: Billing.RecurringBillingItemHandling.FilterItemsInput,
    _config: RemoveZeroQuantityMeteredItemsBeforeCreationConfig,
    _context: Context
  ): Billing.RecurringBillingItemHandling.FilterItemsResult {
    return { items: input.items.map((item) => ({ key: item.key })) };
  }

  groupItems(
    input: Billing.RecurringBillingItemHandling.GroupItemsInput,
    _config: RemoveZeroQuantityMeteredItemsBeforeCreationConfig,
    _context: Context
  ): Billing.RecurringBillingItemHandling.GroupItemsResult {
    return {
      groups:
        input.items.length === 0
          ? []
          : [
              {
                items: input.items.map((item) => ({ key: item.key })),
                setsLatestInvoice: true,
              },
            ],
    };
  }
}
