import type { Billing, Context } from '@stripe/extensibility-sdk/extensions';
import { type MonetaryAmount } from '@stripe/extensibility-sdk/stdlib';

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

    // If currencies don't match, fall back to default behavior
    if (minimumAmount.currency.toLowerCase() !== totalAmount.currency.toLowerCase()) {
      return {
        appliedCustomerBalance: {
          amount: customerBalance.amount,
          currency: totalAmount.currency,
        },
      };
    }

    // Below minimum amount: zero-charge the invoice by applying a credit
    // equal to the invoice total
    if (totalOwed.lt(minimumAmount.amount)) {
      return {
        appliedCustomerBalance: {
          amount: totalAmount.amount.neg(),
          currency: totalAmount.currency,
        },
      };
    }

    // At or above minimum amount: apply the full customer balance
    return {
      appliedCustomerBalance: {
        amount: customerBalance.amount,
        currency: totalAmount.currency,
      },
    };
  }
}
