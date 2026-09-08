interface DecimalValue {
  gt(other: this): boolean;
  lt(other: this): boolean;
  neg(): this;
  sub(other: this): this;
}

interface CustomerBalanceApplicationInput<T extends DecimalValue> {
  totalAmount: { amount: T };
  customerBalance: { amount: T };
}

/**
 * Constrains a proposed customer-balance application to the amount that can
 * safely be applied to an invoice.
 */
export function constrainAppliedAmount<T extends DecimalValue>(
  input: CustomerBalanceApplicationInput<T>,
  appliedAmount: T
): T {
  const zero = appliedAmount.sub(appliedAmount);

  // A credit application cannot make a positive invoice negative. It also
  // cannot be applied to a zero or negative invoice.
  if (appliedAmount.lt(zero)) {
    if (!input.totalAmount.amount.gt(zero)) {
      return zero;
    }

    const minimumAllowedAmount = input.totalAmount.amount.neg();
    return appliedAmount.lt(minimumAllowedAmount) ? minimumAllowedAmount : appliedAmount;
  }

  // A debit application cannot exceed the debit balance supplied as input.
  if (appliedAmount.gt(zero)) {
    if (!input.customerBalance.amount.gt(zero)) {
      return zero;
    }

    return appliedAmount.gt(input.customerBalance.amount)
      ? input.customerBalance.amount
      : appliedAmount;
  }

  return appliedAmount;
}
