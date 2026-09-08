import type { Billing, Context } from '@stripe/extensibility-sdk/extensions';
import { type MonetaryAmount } from '@stripe/extensibility-sdk';
import { constrainAppliedAmount } from '../../../shared/customer_balance_application.js';

export interface MinimumAmountBeforeCollectionConfig extends Record<string, unknown> {
  /**
   * Minimum amount
   * @displayName Minimum amount
   * @exclusiveMinimum :amount 0
   * */
  minimumAmount: MonetaryAmount;
}

export default class MinimumAmountBeforeCollection implements Billing.CustomerBalanceApplication<MinimumAmountBeforeCollectionConfig> {
  computeAppliedCustomerBalance(
    input: Billing.CustomerBalanceApplication.CustomerBalanceApplicationInput,
    config: MinimumAmountBeforeCollectionConfig,
    _context: Context
  ): Billing.CustomerBalanceApplication.CustomerBalanceApplicationResult {
    const { minimumAmount } = config;
    const { totalAmount, customerBalance } = input;
    // Calculate the total amount the customer would owe
    // (positive balance is a debit, meaning they owe money)
    const totalOwed = totalAmount.amount.add(customerBalance.amount);

    let appliedAmount;

    // If currencies don't match, fall back to default behavior.
    if (minimumAmount.currency.toLowerCase() !== totalAmount.currency.toLowerCase()) {
      appliedAmount = customerBalance.amount;
    }
    // Below minimum amount: zero-charge the invoice by applying a credit
    // equal to the invoice total.
    else if (totalOwed.lt(minimumAmount.amount)) {
      appliedAmount = totalAmount.amount.neg();
    }
    // At or above minimum amount: apply the full customer balance.
    else {
      appliedAmount = customerBalance.amount;
    }

    return {
      appliedCustomerBalance: {
        amount: constrainAppliedAmount(input, appliedAmount),
        currency: totalAmount.currency,
      },
    };
  }
}
