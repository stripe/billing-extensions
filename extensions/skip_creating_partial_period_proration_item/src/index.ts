import type { Billing, Context } from '@stripe/extensibility-sdk';

export interface SkipCreatingPartialPeriodProrationItemConfig {
  /**
   * The product metadata key to check for proration suppression
   * @displayName Product metadata key
   */
  metadataKey: string;
  /**
   * The product metadata value that triggers proration suppression
   * @displayName Product metadata value
   */
  metadataValue: string;
}

/**
 * Extracts product metadata from a PriceUnion type.
 *
 * @param item - The item with the PriceUnion to extract metadata from
 * @returns The product metadata, or undefined if not available
 */
function getProductMetadata(
  item: Billing.RecurringBillingItemHandling.Item
): Record<string, string> | undefined {
  if (item.priceKind === 'price') {
    return item.price.product?.metadata ?? undefined;
  }
  return undefined;
}

function hasMatchingMetadata(
  config: SkipCreatingPartialPeriodProrationItemConfig,
  item: Billing.RecurringBillingItemHandling.Item
): boolean {
  const { metadataKey, metadataValue } = config;
  const retrievedMetadataValue = getProductMetadata(item)?.[metadataKey];
  return (
    retrievedMetadataValue !== undefined &&
    retrievedMetadataValue.trim().toLowerCase() === metadataValue.trim().toLowerCase()
  );
}

/** Integer factors do not represent a partial period, even when isProration is true. */
function hasPartialProrationFactor(
  item: Billing.RecurringBillingItemHandling.Item
): boolean {
  return !item.prorationFactor.eq(
    item.prorationFactor.round('round-down', {
      mode: 'decimal-places',
      value: 0,
    })
  );
}

function isMatchingPartialPeriodProrationItem(
  config: SkipCreatingPartialPeriodProrationItemConfig,
  item: Billing.RecurringBillingItemHandling.Item
): boolean {
  return (
    hasMatchingMetadata(config, item) &&
    item.isProration &&
    hasPartialProrationFactor(item)
  );
}

function correspondingDebitSkipped(
  item: Billing.RecurringBillingItemHandling.Item,
  skippedDebitKeys: ReadonlySet<string>
): boolean {
  if (item.type !== 'credit') {
    return false;
  }

  switch (item.creditedItems) {
    case 'invoiceItem':
      return skippedDebitKeys.has(item.invoiceItem.id);
    case 'invoiceLineItems':
      return item.invoiceLineItems.invoiceLineItems.some((line) =>
        skippedDebitKeys.has(line.id)
      );
    default:
      return false;
  }
}

export default class SkipCreatingPartialPeriodProrationItem implements Billing.RecurringBillingItemHandling<SkipCreatingPartialPeriodProrationItemConfig> {
  beforeItemCreation(
    input: Billing.RecurringBillingItemHandling.BeforeItemCreationInput,
    config: SkipCreatingPartialPeriodProrationItemConfig,
    _context: Context
  ): Billing.RecurringBillingItemHandling.BeforeItemCreationResult {
    const skippedItemKeys = new Set<string>();
    const skippedDebitKeys = new Set<string>();
    for (const item of input.items) {
      if (isMatchingPartialPeriodProrationItem(config, item)) {
        skippedItemKeys.add(item.key);
        if (item.type === 'debit') {
          skippedDebitKeys.add(item.key);
        }
      }
    }

    // Resolve associations after collecting every skipped debit, including later items.
    return {
      items: input.items.map((item) => ({
        key: item.key,
        creationStrategy:
          skippedItemKeys.has(item.key) ||
          correspondingDebitSkipped(item, skippedDebitKeys)
            ? 'doNotCreate'
            : 'invoice',
      })),
    };
  }

  filterItems(
    input: Billing.RecurringBillingItemHandling.FilterItemsInput,
    _config: SkipCreatingPartialPeriodProrationItemConfig,
    _context: Context
  ): Billing.RecurringBillingItemHandling.FilterItemsResult {
    return {
      items: input.items.map((item) => ({ key: item.key })),
    };
  }

  groupItems(
    input: Billing.RecurringBillingItemHandling.GroupItemsInput,
    _config: SkipCreatingPartialPeriodProrationItemConfig,
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
