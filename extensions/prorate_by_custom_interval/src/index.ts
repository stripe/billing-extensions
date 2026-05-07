/**
 * Prorate by Custom Interval Extension
 *
 * This Stripe billing extension rounds proration calculations to a specified time interval.
 * Instead of prorating to the exact second, it rounds service periods to the nearest unit
 * (e.g., Hour, Day, Week, Month) and calculates proration factors accordingly.
 *
 * Key Features:
 * - Supports custom intervals: Hour, Day, Week, Month
 * - Uses clean fractional calculations for aligned custom_interval/interval pairs (e.g., Months into years)
 * - Handles calendar arithmetic properly (Month length variations, leap years, Day overflow)
 * - Validates compatibility between custom_interval and billing interval
 *
 * Examples:
 * - Day custom interval + Monthly subscription: rounds 17.5 Days → 18 Days → 18/30 proration (For a Month with 31 Days, denominator adjusts accordingly to the 31 to reflect the Month length)
 * - Month custom interval + yearly subscription: 7.2 Months → 7/12 proration
 * - Week custom interval + Weekly subscription: 2.9 Weeks → 3/3 proration
 */

import type { Billing, Context } from '@stripe/extensibility-sdk/extensions';
import { Decimal } from '@stripe/extensibility-sdk/stdlib';

type RoundingMode = 'round_nearest' | 'round_down' | 'round_up';
type CustomInterval = 'hour' | 'day' | 'week' | 'month';

export interface MyProrationsConfig extends Record<string, unknown> {
  /**
   * The custom time interval to round to. Supported values: Hour, Day, Week, Month
   * @displayName Custom interval
   * @displayName :hour Hour
   * @displayName :day Day
   * @displayName :week Week
   * @displayName :month Month
   */
  customInterval: CustomInterval;
  /**
   * The rounding behavior when determining custom time interval units. 'Round to nearest interval' rounds to nearest unit (default), 'Always round down' always rounds down, 'Always round up' always rounds up
   * @displayName Rounding mode
   * @displayName :round_nearest Round to nearest interval
   * @displayName :round_down Always round down
   * @displayName :round_up Always round up
   */
  roundingMode: RoundingMode;
}

/**
 * Applies the configured rounding mode to a decimal value.
 *
 * Note: "Always round down" maps to Math.ceil and "Always round up" maps to Math.floor because the
 * names describe the monetary effect (round down = larger period/amount), not the
 * direction the unit count moves.
 */
function applyRoundingMode(value: Decimal, roundingMode: RoundingMode): Decimal {
  switch (roundingMode) {
    case 'round_down':
      return value.round('round-up', { mode: 'decimal-places', value: 0 });
    case 'round_up':
      return value.round('round-down', { mode: 'decimal-places', value: 0 });
    case 'round_nearest':
    default:
      return value.round('half-up', { mode: 'decimal-places', value: 0 });
  }
}

/**
 * Validates that the configured interval is compatible with the billing interval.
 *
 * Compatibility Rules:
 * - Hour/Day: Compatible with ALL intervals (universal)
 * - Week: Only compatible with Weekly intervals
 * - Month: Compatible with Monthly and yearly intervals
 *
 * Rationale: A granularity must divide evenly into the billing period.
 * For example, you can't round to Weeks on a Monthly subscription because
 * Weeks don't align properly with Month boundaries.
 *
 * @param custom_interval - The rounding granularity (e.g., "Hour", "Day", "Week", "Month")
 * @param interval - The billing interval (e.g., "Day", "Week", "Month", "year")
 * @returns True if compatible, false otherwise
 */
function isCustomIntervalCompatibleWithInterval(
  customInterval: CustomInterval,
  billingInterval: Billing.Prorations.RecurringPriceInterval
): boolean {
  // Hour and Day are compatible with all intervals
  if (customInterval === 'hour' || customInterval === 'day') {
    return true;
  }

  // Week is only compatible with Week interval
  if (customInterval === 'week') {
    return billingInterval === 'week';
  }

  // Month is compatible with Month and year intervals
  if (customInterval === 'month') {
    return billingInterval === 'month' || billingInterval === 'year';
  }

  return false;
}

/**
 * Converts fixed-duration custom intervals to milliseconds.
 *
 * These custom intervals have consistent durations regardless of calendar variations.
 * Used for simple arithmetic calculations with timestamps.
 *
 * Supported: Hour, Day, Week
 * Not supported here: Month (variable lengths)
 *
 * @param custom_interval - The custom interval string
 * @returns Duration in milliseconds (defaults to 1000ms for unknown values)
 */
function getGranularityMs(interval: string): Decimal {
  switch (interval.toLowerCase()) {
    case 'hour':
      return Decimal.from(60 * 60 * 1000);
    case 'day':
      return Decimal.from(24 * 60 * 60 * 1000);
    case 'week':
      return Decimal.from(7 * 24 * 60 * 60 * 1000);
    default:
      return Decimal.from(60 * 60 * 1000);
  }
}

/**
 * Subtracts calendar Months (or years converted to Months) from a date, clamping
 * the Day to the last valid Day of the target Month.
 *
 * Examples:
 * - Jan 15 − 1 Month = Dec 15
 * - Mar 31 − 1 Month = Feb 28 (clamped; Feb 31 doesn't exist)
 */
function subtractCalendarPeriods(date: Date, interval: string, units: Decimal): Date {
  const year = date.getUTCFullYear();
  const Month = date.getUTCMonth();
  const Day = date.getUTCDate();
  const Hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();
  const ms = date.getUTCMilliseconds();

  let MonthsToSubtract = 0;
  switch (interval.toLowerCase()) {
    case 'month':
      MonthsToSubtract = units.toNumber();
      break;
    case 'year':
      MonthsToSubtract = units.toNumber() * 12;
      break;
  }

  let targetYear = year;
  let targetMonth = Month - MonthsToSubtract;

  // Normalize Month and year boundaries
  // Example: Month = -2 becomes Month = 10 of previous year
  while (targetMonth < 0) {
    targetMonth += 12;
    targetYear -= 1;
  }
  while (targetMonth >= 12) {
    targetMonth -= 12;
    targetYear += 1;
  }

  // Clamp Day to the last valid Day of the target Month (e.g. Jan 31 → Feb 28)
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0)
  ).getUTCDate();
  const targetDay = Math.min(Day, lastDayOfTargetMonth);

  return new Date(
    Date.UTC(targetYear, targetMonth, targetDay, Hours, minutes, seconds, ms)
  );
}

/**
 * Counts fractional calendar months between two dates using proper calendar arithmetic.
 *
 * Finds the largest integer n such that (startDate + n months) <= endDate, then adds
 * a fractional part based on where endDate falls within the next calendar month.
 *
 * Example: Jan 16 2026 → Jan 15 2027 = 11 + 30/31 ≈ 11.968 months
 *          (11 full months lands on Dec 16; Dec 16 → Jan 15 = 30 days out of 31)
 */
function calcCalendarMonthUnits(startDate: Date, endDate: Date): Decimal {
  const sy = startDate.getUTCFullYear();
  const sm = startDate.getUTCMonth();
  const sd = startDate.getUTCDate();
  const sh = startDate.getUTCHours();
  const smin = startDate.getUTCMinutes();
  const ss = startDate.getUTCSeconds();
  const sms = startDate.getUTCMilliseconds();

  const addMonthsToStart = (months: number): Date => {
    const totalMonths = sm + months;
    const targetYear = sy + Math.floor(totalMonths / 12);
    const targetMonth = totalMonths % 12;
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    return new Date(
      Date.UTC(targetYear, targetMonth, Math.min(sd, lastDay), sh, smin, ss, sms)
    );
  };

  const ey = endDate.getUTCFullYear();
  const em = endDate.getUTCMonth();
  let n = (ey - sy) * 12 + (em - sm);

  let anchor = addMonthsToStart(n);
  if (anchor > endDate) {
    n -= 1;
    anchor = addMonthsToStart(n);
  }

  const nextAnchor = addMonthsToStart(n + 1);
  const numeratorMs = endDate.getTime() - anchor.getTime();
  const denominatorMs = nextAnchor.getTime() - anchor.getTime();

  const fraction =
    denominatorMs > 0
      ? Decimal.from(numeratorMs).div(Decimal.from(denominatorMs), 12, 'half-even')
      : Decimal.zero;
  return Decimal.from(n).add(fraction);
}

/**
 * Returns the number of custom interval units in the full billing period (the denominator).
 *
 * For Month custom interval, returns an exact integer count (avoids approximation errors).
 * For Hour/Day/Week, divides the actual calendar duration of the period by the unit size
 * so that Month-length variations (e.g. 28 vs 31 Days) are reflected correctly.
 *
 * Examples: Day+Month(Jan)→31, Day+year(non-leap)→365, Month+year→12, Hour+Day→24
 *
 * Returns null for unknown intervals (caller falls back to original item data).
 */
function calculateDenominatorUnits(
  billingInterval: Billing.Prorations.RecurringPriceInterval,
  intervalCount: Decimal,
  customInterval: CustomInterval,
  periodEndDate: Date
): Decimal | null {
  if (customInterval === 'month') {
    if (billingInterval === 'month') {
      return intervalCount;
    }
    if (billingInterval === 'year') {
      return intervalCount.mul(Decimal.from(12));
    }
    return null;
  }

  const customIntervalMs = getGranularityMs(customInterval);

  let fullPeriodMs: Decimal;
  if (billingInterval === 'day') {
    fullPeriodMs = intervalCount.mul(Decimal.from(24 * 60 * 60 * 1000));
  } else if (billingInterval === 'week') {
    fullPeriodMs = intervalCount.mul(Decimal.from(7 * 24 * 60 * 60 * 1000));
  } else if (billingInterval === 'month' || billingInterval === 'year') {
    const periodStart = subtractCalendarPeriods(
      periodEndDate,
      billingInterval,
      intervalCount
    );
    fullPeriodMs = Decimal.from(periodEndDate.getTime() - periodStart.getTime());
  } else {
    return null;
  }

  return fullPeriodMs.div(customIntervalMs, 12, 'half-even');
}

/**
 * Returns the denominator for a CREDIT item that has a corresponding debit.
 *
 * A credit's factor is relative to what the debit was charged for, so the denominator
 * is the rounded duration of the debit's service period (same rounding mode as the credit).
 *
 * Example: debit Jan 10→Feb 1 = 22 Days → denominatorUnits = round(22) = 22.
 *          credit Jan 20→Feb 1 = 12 Days → proration_factor = -(12/22).
 */
function calculateCreditDenominatorUnits(
  debitServicePeriod: Billing.TimeRange,
  customInterval: CustomInterval,
  roundingMode: RoundingMode
): Decimal {
  const debitTimeDiffMs =
    new Date(debitServicePeriod.endDate).getTime() -
    new Date(debitServicePeriod.startDate).getTime();

  let rawDebitUnits: Decimal;
  if (customInterval === 'month') {
    rawDebitUnits = calcCalendarMonthUnits(
      new Date(debitServicePeriod.startDate),
      new Date(debitServicePeriod.endDate)
    );
  } else {
    rawDebitUnits = Decimal.from(debitTimeDiffMs).div(
      getGranularityMs(customInterval),
      12,
      'half-even'
    );
  }

  return applyRoundingMode(rawDebitUnits, roundingMode);
}

/**
 * Recurring interval data extracted from a PriceUnion.
 */
type RecurringData = {
  interval: Billing.Prorations.RecurringPriceInterval;
  intervalCount: Decimal;
};

/**
 * Extracts recurring interval data from a PriceUnion.
 * - For 'price' type: uses recurring.interval and recurring.interval_count
 * - For 'license_fee' type: uses service_interval and service_interval_count
 * - For 'rate_card_rate' and 'custom_pricing_unit_overage_rate': returns undefined (usage-based)
 *
 * @param priceUnion - The PriceUnion to extract recurring data from
 * @returns The recurring data, or undefined if not available
 */
function getRecurringData(
  item: Billing.Prorations.ProratableItem
): RecurringData | undefined {
  if (item.priceKind === 'price') {
    const recurring = item.price.recurring;
    if (recurring) {
      return {
        interval: recurring.interval,
        intervalCount: Decimal.from(recurring.intervalCount),
      };
    }
    return undefined;
  }

  if (item.priceKind === 'licenseFee') {
    return {
      interval: item.licenseFee.serviceInterval,
      intervalCount: Decimal.from(item.licenseFee.serviceIntervalCount),
    };
  }

  // rate_card_rate and custom_pricing_unit_overage_rate have no recurring interval
  return undefined;
}

/**
 * Calculates proration data for a given item.
 *
 * @param item - The proratable item to calculate proration data for
 * @param customInterval - The custom interval to round to
 * @param roundingMode - The rounding mode to apply
 * @returns The proration data, including the proration factor and adjusted service period
 */
function calculateProrationData(
  item: Billing.Prorations.ProratableItem,
  customInterval: CustomInterval,
  roundingMode: RoundingMode
): { prorationFactor: Decimal; adjustedServicePeriod: Billing.TimeRange } {
  const originalEnd = new Date(item.servicePeriod.endDate);

  // If the item is not a proration item leave as-is
  if (!item.isProration) {
    return {
      prorationFactor: item.currentProrationFactor,
      adjustedServicePeriod: item.servicePeriod,
    };
  }

  // Validate granularity compatibility with billing interval
  const recurringData = getRecurringData(item);
  const recurringInterval = recurringData?.interval;
  const intervalCount = recurringData?.intervalCount ?? Decimal.from(1);

  // If the interval is not recurring or it is not compatible with the custom interval, leave as-is
  if (
    !recurringInterval ||
    (recurringInterval &&
      !isCustomIntervalCompatibleWithInterval(customInterval, recurringInterval))
  ) {
    return {
      prorationFactor: item.currentProrationFactor,
      adjustedServicePeriod: item.servicePeriod,
    };
  }

  // Calculate the denominator:
  // - CREDIT with correspondingDebit: rounded units of the debit's service period
  // - All other items (DEBIT, or CREDIT without a corresponding_debit): full billing period
  let denominatorUnits: Decimal;
  if (item.type === 'credit' && item.correspondingDebit) {
    denominatorUnits = calculateCreditDenominatorUnits(
      item.correspondingDebit.servicePeriod,
      customInterval,
      roundingMode
    );
  } else {
    const billingPeriodUnits = calculateDenominatorUnits(
      recurringInterval,
      intervalCount,
      customInterval,
      originalEnd
    );
    if (billingPeriodUnits === null) {
      return {
        prorationFactor: item.currentProrationFactor,
        adjustedServicePeriod: item.servicePeriod,
      };
    }
    denominatorUnits = billingPeriodUnits;
  }

  const timeDiffMs =
    originalEnd.getTime() - new Date(item.servicePeriod.startDate).getTime();

  // Numerator: fractional units in the service period, rounded per rounding_mode.
  // Month uses calendar-aware counting to avoid 30-day approximation errors.
  let rawUnits: Decimal;
  if (customInterval === 'month') {
    rawUnits = calcCalendarMonthUnits(
      new Date(item.servicePeriod.startDate),
      originalEnd
    );
  } else {
    rawUnits = Decimal.from(timeDiffMs).div(
      getGranularityMs(customInterval),
      12,
      'half-even'
    );
  }

  const roundedUnits = applyRoundingMode(rawUnits, roundingMode);

  let adjustedStart: Date;
  if (customInterval === 'month') {
    adjustedStart = subtractCalendarPeriods(originalEnd, 'month', roundedUnits);
  } else {
    adjustedStart = new Date(
      originalEnd.getTime() -
        roundedUnits.mul(getGranularityMs(customInterval)).toNumber()
    );
  }

  let prorationFactor = denominatorUnits.isPositive()
    ? roundedUnits.div(denominatorUnits, 12, 'half-even')
    : Decimal.from(1);

  if (item.type === 'credit') {
    prorationFactor = prorationFactor.neg();
  }

  const adjustedServicePeriod: Billing.TimeRange = {
    startDate: adjustedStart,
    endDate: originalEnd,
  };

  return {
    prorationFactor,
    adjustedServicePeriod,
  };
}

export default class MyProrations implements Billing.Prorations<MyProrationsConfig> {
  prorateItems(
    input: Billing.Prorations.ProrateItemsInput,
    config: MyProrationsConfig,
    _context: Context
  ) {
    const { customInterval, roundingMode } = config;
    const { items } = input;

    return {
      items: items.map((item: Billing.Prorations.ProratableItem) => {
        const prorationData = calculateProrationData(item, customInterval, roundingMode);
        return {
          key: item.key,
          prorationFactor: prorationData.prorationFactor,
          lineItemPeriod: prorationData.adjustedServicePeriod,
        };
      }),
    };
  }
}
