/**
 * Credit and debit full product price extension
 *
 * This Stripe Billing extension prevents prorations for products with specific metadata.
 * When a product has the configured metadata key set to the configured metadata value (case insensitive),
 * the proration factor is set to 1.0 (full charge) for debit items, effectively disabling prorations for that product.
 * For credit items, the proration factor is set to -1.0 (full refund), effectively disabling prorations for that product.
 *
 * Key Features:
 * - Checks product metadata for a configurable key/value pair
 * - Metadata value matching is case-insensitive
 * - Sets proration factor to 1.0 for debit items when metadata matches
 * - Sets proration factor to -1.0 for credit items when metadata matches
 * - Overrides line item period start date to the beginning of the full billing interval
 *
 * Use Cases:
 * - Products that should always be charged in full regardless of usage period for debit items
 * - Products that should always be refunded in full regardless of usage period for credit items
 * - Subscriptions where partial period charges are not desired
 * - Simplified billing for certain product types
 */

import type { Billing, Context } from '@stripe/extensibility-sdk/extensions';
import { Decimal } from '@stripe/extensibility-sdk';

export interface CreditAndDebitFullProductPriceConfig extends Record<string, unknown> {
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
 * Subtracts a billing interval from a date, respecting calendar boundaries.
 *
 * For DAY and WEEK intervals, subtracts the exact number of milliseconds.
 * For MONTH and YEAR intervals, preserves the day-of-month where possible,
 * clamping to the last day of the target month when the day doesn't exist
 * (e.g. March 31 minus 1 month → Feb 28/29; Feb 29 minus 1 year → Feb 28
 * if the target year is not a leap year).
 */

export function subtractInterval(
  endDate: Date,
  interval: Billing.Prorations.RecurringPriceInterval,
  intervalCount: number
): Date {
  if (interval === 'day') {
    return new Date(endDate.getTime() - intervalCount * 24 * 60 * 60 * 1000);
  }

  if (interval === 'week') {
    return new Date(endDate.getTime() - intervalCount * 7 * 24 * 60 * 60 * 1000);
  }

  if (interval === 'month') {
    const originalDay = endDate.getUTCDate();
    const rawMonth = endDate.getUTCMonth() - intervalCount;
    const targetYear = endDate.getUTCFullYear() + Math.floor(rawMonth / 12);
    const targetMonth = ((rawMonth % 12) + 12) % 12;
    // Last day of the target month (day 0 of the following month)
    const lastDayOfTargetMonth = new Date(
      Date.UTC(targetYear, targetMonth + 1, 0)
    ).getUTCDate();
    const targetDay = Math.min(originalDay, lastDayOfTargetMonth);
    return new Date(
      Date.UTC(
        targetYear,
        targetMonth,
        targetDay,
        endDate.getUTCHours(),
        endDate.getUTCMinutes(),
        endDate.getUTCSeconds(),
        endDate.getUTCMilliseconds()
      )
    );
  }

  // YEAR
  const originalDay = endDate.getUTCDate();
  const originalMonth = endDate.getUTCMonth();
  const targetYear = endDate.getUTCFullYear() - intervalCount;
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, originalMonth + 1, 0)
  ).getUTCDate();
  const targetDay = Math.min(originalDay, lastDayOfTargetMonth);
  return new Date(
    Date.UTC(
      targetYear,
      originalMonth,
      targetDay,
      endDate.getUTCHours(),
      endDate.getUTCMinutes(),
      endDate.getUTCSeconds(),
      endDate.getUTCMilliseconds()
    )
  );
}

/**
 * Extracts product metadata from a PriceUnion type.
 *
 * @param item - The item with the PriceUnion to extract metadata from
 * @returns The product metadata, or undefined if not available
 */
function getProductMetadata(
  item: Billing.Prorations.ProratableItem
): Record<string, string> | undefined {
  if (item.priceKind === 'price') {
    return item.price.product?.metadata ?? undefined;
  }
  return undefined;
}

/*
 * Proration function that checks product metadata and sets full charge when appropriate.
 *
 * @param input - Input containing items to prorate
 * @param config - Configuration specifying the metadata key and value to match
 * @param _context - The runtime context (unused)
 * @returns ProrateItemsResult with adjusted proration factors
 */

export default class CreditAndDebitFullProductPrice implements Billing.Prorations<CreditAndDebitFullProductPriceConfig> {
  prorateItems(
    input: Billing.Prorations.ProrateItemsInput,
    config: CreditAndDebitFullProductPriceConfig,
    _context: Context
  ): Billing.Prorations.ProrateItemsResult {
    const { metadataKey, metadataValue } = config;
    return {
      items: input.items.map((item: Billing.Prorations.ProratableItem) => {
        const productMetadata = getProductMetadata(item);
        const retrievedMetadataValue = productMetadata?.[metadataKey];
        const hasMatchingMetadata =
          retrievedMetadataValue !== undefined &&
          retrievedMetadataValue.trim().toLowerCase() ===
            metadataValue.trim().toLowerCase();

        if (hasMatchingMetadata) {
          const recurring = item.priceKind === 'price' ? item.price.recurring : undefined;
          const endDate = item.servicePeriod.endDate;
          const startDate =
            recurring != null
              ? subtractInterval(endDate, recurring.interval, recurring.intervalCount)
              : item.servicePeriod.startDate;

          return {
            key: item.key,
            prorationFactor:
              item.type === 'credit' ? Decimal.from(-1.0) : Decimal.from(1.0),
            lineItemPeriod: {
              startDate: startDate,
              endDate: endDate,
            },
          };
        }

        // Otherwise, preserve the current proration factor and line item period
        return {
          key: item.key,
          prorationFactor: item.currentProrationFactor,
          lineItemPeriod: item.servicePeriod,
        };
      }),
    };
  }
}
