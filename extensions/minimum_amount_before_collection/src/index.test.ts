import { describe, test, expect } from 'vitest';
import type { Billing, Context } from '@stripe/extensibility-sdk/extensions';
import MinimumAmountBeforeCollection, {
  type MinimumAmountBeforeCollectionConfig,
} from './index.js';
import { Decimal } from '@stripe/extensibility-sdk/stdlib';

describe('MinimumAmountBeforeCollection', () => {
  const mockContext: Context = {
    type: 'script',
    id: 'script_test123',
    livemode: false,
    stripeContext: 'acct_test123',
    clockTime: '2023-01-01T00:00:00Z',
  };

  const baseConfig: MinimumAmountBeforeCollectionConfig = {
    minimumAmount: { amount: Decimal.from(5000), currency: 'usd' },
  };

  const makeInput = (
    totalAmount: number,
    customerBalance: number,
    currency: Billing.Currency = 'usd'
  ): Billing.CustomerBalanceApplication.CustomerBalanceApplicationInput => ({
    totalAmount: { amount: Decimal.from(totalAmount), currency },
    customerBalance: { amount: Decimal.from(customerBalance), currency },
  });

  test('zeros out invoice when below threshold with negative customer balance', () => {
    const input = makeInput(3000, -1000);

    const result = new MinimumAmountBeforeCollection().computeAppliedCustomerBalance(
      input,
      baseConfig,
      mockContext
    );

    expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(-3000));
    expect(result.appliedCustomerBalance.currency).toEqual('usd');
  });

  test('applies full customer balance when total exceeds threshold', () => {
    const input = makeInput(10000, 2500);

    const result = new MinimumAmountBeforeCollection().computeAppliedCustomerBalance(
      input,
      baseConfig,
      mockContext
    );

    expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(2500));
    expect(result.appliedCustomerBalance.currency).toEqual('usd');
  });

  test('zeros out invoice when total is below threshold', () => {
    const input = makeInput(3000, 1500);

    const result = new MinimumAmountBeforeCollection().computeAppliedCustomerBalance(
      input,
      baseConfig,
      mockContext
    );

    expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(-3000));
    expect(result.appliedCustomerBalance.currency).toEqual('usd');
  });

  test('applies full customer balance when total equals threshold', () => {
    const input = makeInput(5000, 2000);

    const result = new MinimumAmountBeforeCollection().computeAppliedCustomerBalance(
      input,
      baseConfig,
      mockContext
    );

    expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(2000));
    expect(result.appliedCustomerBalance.currency).toEqual('usd');
  });

  test('preserves currency from input', () => {
    const input = makeInput(10000, 1500, 'eur');

    const result = new MinimumAmountBeforeCollection().computeAppliedCustomerBalance(
      input,
      baseConfig,
      mockContext
    );

    expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(1500));
    expect(result.appliedCustomerBalance.currency).toEqual('eur');
  });

  test('handles zero customer balance', () => {
    const input = makeInput(10000, 0);

    const result = new MinimumAmountBeforeCollection().computeAppliedCustomerBalance(
      input,
      baseConfig,
      mockContext
    );

    expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(0));
    expect(result.appliedCustomerBalance.currency).toEqual('usd');
  });

  test('zeros out invoice when below threshold with large negative customer balance', () => {
    const input = makeInput(3000, -5000);

    const result = new MinimumAmountBeforeCollection().computeAppliedCustomerBalance(
      input,
      baseConfig,
      mockContext
    );

    expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(-3000));
    expect(result.appliedCustomerBalance.currency).toEqual('usd');
  });

  test('applies full customer balance when threshold is zero', () => {
    const configWithZeroThreshold: MinimumAmountBeforeCollectionConfig = {
      minimumAmount: { amount: Decimal.from(0), currency: 'usd' },
    };
    const input = makeInput(1000, 500);

    const result = new MinimumAmountBeforeCollection().computeAppliedCustomerBalance(
      input,
      configWithZeroThreshold,
      mockContext
    );

    expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(500));
    expect(result.appliedCustomerBalance.currency).toEqual('usd');
  });

  test('zeros out invoice when threshold is very high', () => {
    const configWithHighThreshold: MinimumAmountBeforeCollectionConfig = {
      minimumAmount: { amount: Decimal.from(1000000), currency: 'usd' },
    };
    const input = makeInput(50000, 10000);

    const result = new MinimumAmountBeforeCollection().computeAppliedCustomerBalance(
      input,
      configWithHighThreshold,
      mockContext
    );

    expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(-50000));
    expect(result.appliedCustomerBalance.currency).toEqual('usd');
  });

  test('returns original customer balance when threshold currency does not match bill currency', () => {
    const configWithEurThreshold: MinimumAmountBeforeCollectionConfig = {
      minimumAmount: { amount: Decimal.from(5000), currency: 'eur' },
    };
    const input = makeInput(10000, 2500);

    const result = new MinimumAmountBeforeCollection().computeAppliedCustomerBalance(
      input,
      configWithEurThreshold,
      mockContext
    );

    expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(2500));
    expect(result.appliedCustomerBalance.currency).toEqual('usd');
  });

  test('handles currency mismatch with negative customer balance', () => {
    const configWithGbpThreshold: MinimumAmountBeforeCollectionConfig = {
      minimumAmount: { amount: Decimal.from(5000), currency: 'gbp' },
    };
    const input = makeInput(3000, -1000);

    const result = new MinimumAmountBeforeCollection().computeAppliedCustomerBalance(
      input,
      configWithGbpThreshold,
      mockContext
    );

    expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(-1000));
    expect(result.appliedCustomerBalance.currency).toEqual('usd');
  });

  test('applies full customer balance when totalOwed exactly equals threshold', () => {
    const input = makeInput(3000, 2000);

    const result = new MinimumAmountBeforeCollection().computeAppliedCustomerBalance(
      input,
      baseConfig,
      mockContext
    );

    expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(2000));
    expect(result.appliedCustomerBalance.currency).toEqual('usd');
  });

  test('applies full customer balance when totalOwed is just above threshold', () => {
    const input = makeInput(3001, 2000);

    const result = new MinimumAmountBeforeCollection().computeAppliedCustomerBalance(
      input,
      baseConfig,
      mockContext
    );

    expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(2000));
    expect(result.appliedCustomerBalance.currency).toEqual('usd');
  });

  test('zeros out invoice when totalOwed is just below threshold', () => {
    const input = makeInput(2999, 2000);

    const result = new MinimumAmountBeforeCollection().computeAppliedCustomerBalance(
      input,
      baseConfig,
      mockContext
    );

    expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(-2999));
    expect(result.appliedCustomerBalance.currency).toEqual('usd');
  });

  test('zeros out zero invoice with positive customer balance below threshold', () => {
    const input = makeInput(0, 1000);

    const result = new MinimumAmountBeforeCollection().computeAppliedCustomerBalance(
      input,
      baseConfig,
      mockContext
    );

    expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(0).neg());
    expect(result.appliedCustomerBalance.currency).toEqual('usd');
  });

  test('handles zero invoice with negative customer balance', () => {
    const input = makeInput(0, -2000);

    const result = new MinimumAmountBeforeCollection().computeAppliedCustomerBalance(
      input,
      baseConfig,
      mockContext
    );

    expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(0).neg());
    expect(result.appliedCustomerBalance.currency).toEqual('usd');
  });

  test('applies full customer balance when zero invoice with large positive balance exceeds threshold', () => {
    const input = makeInput(0, 10000);

    const result = new MinimumAmountBeforeCollection().computeAppliedCustomerBalance(
      input,
      baseConfig,
      mockContext
    );

    expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(10000));
    expect(result.appliedCustomerBalance.currency).toEqual('usd');
  });

  test('bug bash scenario 1: $4 credit + $12 invoice below $10 threshold', () => {
    const configWith10DollarThreshold: MinimumAmountBeforeCollectionConfig = {
      minimumAmount: { amount: Decimal.from(1000), currency: 'usd' },
    };
    const input = makeInput(1200, -400);

    const result = new MinimumAmountBeforeCollection().computeAppliedCustomerBalance(
      input,
      configWith10DollarThreshold,
      mockContext
    );

    expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(-1200));
    expect(result.appliedCustomerBalance.currency).toEqual('usd');
  });

  test('bug bash scenario 2: $4 credit + $3 invoice below $10 threshold', () => {
    const configWith10DollarThreshold: MinimumAmountBeforeCollectionConfig = {
      minimumAmount: { amount: Decimal.from(1000), currency: 'usd' },
    };
    const input = makeInput(300, -400);

    const result = new MinimumAmountBeforeCollection().computeAppliedCustomerBalance(
      input,
      configWith10DollarThreshold,
      mockContext
    );

    expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(-300));
    expect(result.appliedCustomerBalance.currency).toEqual('usd');
  });
});
