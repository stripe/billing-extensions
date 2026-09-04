import type { Billing, Context } from '@stripe/extensibility-sdk/extensions';
import { Decimal, type MonetaryAmount } from '@stripe/extensibility-sdk';
import { constrainAppliedAmount } from '../../../shared/customer_balance_application.js';

export interface MaximumCreditPerInvoiceConfig extends Record<string, unknown> {
  /**
   * Maximum credit amount
   * @displayName Maximum credit amount
   * @exclusiveMinimum :amount 0
   * */
  maximumCreditAmount: MonetaryAmount;
}

export default class MyCustomerBalanceApplication implements Billing.CustomerBalanceApplication<MaximumCreditPerInvoiceConfig> {
  computeAppliedCustomerBalance(
    input: Billing.CustomerBalanceApplication.CustomerBalanceApplicationInput,
    config: MaximumCreditPerInvoiceConfig,
    _context: Context
  ) {
    const { maximumCreditAmount } = config;

    let appliedAmount: Decimal;

    // If currency of the max credit doesn't match the currency of the bill_details, return the original customer balance
    if (
      maximumCreditAmount.currency.toLowerCase() !==
      input.totalAmount.currency.toLowerCase()
    ) {
      appliedAmount = input.customerBalance.amount;
    }
    // If customer has debit balance (positive), apply all of it
    else if (input.customerBalance.amount.gte(Decimal.from(0))) {
      appliedAmount = input.customerBalance.amount;
    }
    // Customer has credit balance (negative) - apply at most the maximum credit amount
    else {
      // Use gt comparison in place of Math.max to limit credit application
      // Example: customer_balance = -5000, max = -2000 -> apply -2000 (limit credit to $20)
      // Example: customer_balance = -1500, max = -2000 -> apply -1500 (apply all credit)
      appliedAmount = input.customerBalance.amount.gt(maximumCreditAmount.amount.neg())
        ? input.customerBalance.amount
        : maximumCreditAmount.amount.neg();
    }

    appliedAmount = constrainAppliedAmount(input, appliedAmount);

    return {
      appliedCustomerBalance: {
        amount: appliedAmount,
        currency: input.totalAmount.currency,
      },
    };
  }
}
