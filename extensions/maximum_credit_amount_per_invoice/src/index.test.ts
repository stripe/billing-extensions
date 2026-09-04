import { describe, test, expect } from 'vitest';
import type { Billing, Context } from '@stripe/extensibility-sdk/extensions';
import MaximumCreditPerInvoice, { type MaximumCreditPerInvoiceConfig } from './index.js';
import { Decimal } from '@stripe/extensibility-sdk';

describe('MaximumCreditPerInvoice', () => {
  const mockContext: Context = {
    type: 'script',
    id: 'script_test123',
    livemode: false,
    stripeContext: 'acct_test123',
    clockTime: '2023-01-01T00:00:00Z',
  };
  const baseConfig: MaximumCreditPerInvoiceConfig = {
    maximumCreditAmount: { amount: Decimal.from(2000), currency: 'usd' },
  };

  const makeInput = (
    totalAmount: number,
    customerBalance: number,
    currency: Billing.Currency = 'usd'
  ): Billing.CustomerBalanceApplication.CustomerBalanceApplicationInput => ({
    totalAmount: { amount: Decimal.from(totalAmount), currency },
    customerBalance: { amount: Decimal.from(customerBalance), currency },
  });

  describe('credit balance scenarios', () => {
    test('applies full credit when below limit', () => {
      const input = makeInput(10000, -1500);

      const result = new MaximumCreditPerInvoice().computeAppliedCustomerBalance(
        input,
        baseConfig,
        mockContext
      );

      expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(-1500));
      expect(result.appliedCustomerBalance.currency).toEqual('usd');
    });

    test('limits credit when above limit', () => {
      const input = makeInput(10000, -5000);

      const result = new MaximumCreditPerInvoice().computeAppliedCustomerBalance(
        input,
        baseConfig,
        mockContext
      );

      expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(-2000));
      expect(result.appliedCustomerBalance.currency).toEqual('usd');
    });

    test('applies exactly the limit when credit equals limit', () => {
      const input = makeInput(10000, -2000);

      const result = new MaximumCreditPerInvoice().computeAppliedCustomerBalance(
        input,
        baseConfig,
        mockContext
      );

      expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(-2000));
      expect(result.appliedCustomerBalance.currency).toEqual('usd');
    });

    test('limits large credit balance', () => {
      const input = makeInput(5000, -10000);

      const result = new MaximumCreditPerInvoice().computeAppliedCustomerBalance(
        input,
        baseConfig,
        mockContext
      );

      expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(-2000));
      expect(result.appliedCustomerBalance.currency).toEqual('usd');
    });

    test('applies small credit balance fully', () => {
      const input = makeInput(10000, -500);

      const result = new MaximumCreditPerInvoice().computeAppliedCustomerBalance(
        input,
        baseConfig,
        mockContext
      );

      expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(-500));
      expect(result.appliedCustomerBalance.currency).toEqual('usd');
    });
  });

  describe('debit balance scenarios', () => {
    test('applies full debit balance normally', () => {
      const input = makeInput(10000, 3000);

      const result = new MaximumCreditPerInvoice().computeAppliedCustomerBalance(
        input,
        baseConfig,
        mockContext
      );

      expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(3000));
      expect(result.appliedCustomerBalance.currency).toEqual('usd');
    });

    test('applies large debit balance fully', () => {
      const input = makeInput(5000, 10000);

      const result = new MaximumCreditPerInvoice().computeAppliedCustomerBalance(
        input,
        baseConfig,
        mockContext
      );

      expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(10000));
      expect(result.appliedCustomerBalance.currency).toEqual('usd');
    });
  });

  describe('zero balance scenarios', () => {
    test('handles zero customer balance', () => {
      const input = makeInput(10000, 0);

      const result = new MaximumCreditPerInvoice().computeAppliedCustomerBalance(
        input,
        baseConfig,
        mockContext
      );

      expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(0));
      expect(result.appliedCustomerBalance.currency).toEqual('usd');
    });

    test('does not apply credit to a zero invoice', () => {
      const input = makeInput(0, -3000);

      const result = new MaximumCreditPerInvoice().computeAppliedCustomerBalance(
        input,
        baseConfig,
        mockContext
      );

      expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(0));
      expect(result.appliedCustomerBalance.currency).toEqual('usd');
    });
  });

  describe('currency handling', () => {
    test('applies credit limit with matching currency', () => {
      const input = makeInput(10000, -5000, 'eur');
      const configWithEur: MaximumCreditPerInvoiceConfig = {
        maximumCreditAmount: { amount: Decimal.from(2000), currency: 'eur' },
      };

      const result = new MaximumCreditPerInvoice().computeAppliedCustomerBalance(
        input,
        configWithEur,
        mockContext
      );

      expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(-2000));
      expect(result.appliedCustomerBalance.currency).toEqual('eur');
    });

    test('returns original balance when currency mismatch', () => {
      const input = makeInput(10000, -5000);
      const configWithEur: MaximumCreditPerInvoiceConfig = {
        maximumCreditAmount: { amount: Decimal.from(2000), currency: 'eur' },
      };

      const result = new MaximumCreditPerInvoice().computeAppliedCustomerBalance(
        input,
        configWithEur,
        mockContext
      );

      expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(-5000));
      expect(result.appliedCustomerBalance.currency).toEqual('usd');
    });

    test('caps a mismatched-currency credit at the invoice total', () => {
      const input = makeInput(1000, -5000);
      const configWithEur: MaximumCreditPerInvoiceConfig = {
        maximumCreditAmount: { amount: Decimal.from(2000), currency: 'eur' },
      };

      const result = new MaximumCreditPerInvoice().computeAppliedCustomerBalance(
        input,
        configWithEur,
        mockContext
      );

      expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(-1000));
      expect(result.appliedCustomerBalance.currency).toEqual('usd');
    });
  });

  describe('edge cases', () => {
    test('caps credit at the invoice total', () => {
      const input = makeInput(1000, -5000);

      const result = new MaximumCreditPerInvoice().computeAppliedCustomerBalance(
        input,
        baseConfig,
        mockContext
      );

      expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(-1000));
      expect(result.appliedCustomerBalance.currency).toEqual('usd');
    });

    test('does not apply credit to a negative invoice', () => {
      const input = makeInput(-1000, -5000);

      const result = new MaximumCreditPerInvoice().computeAppliedCustomerBalance(
        input,
        baseConfig,
        mockContext
      );

      expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(0));
      expect(result.appliedCustomerBalance.currency).toEqual('usd');
    });

    test('handles zero credit limit', () => {
      const configWithZeroLimit: MaximumCreditPerInvoiceConfig = {
        maximumCreditAmount: { amount: Decimal.from(0), currency: 'usd' },
      };
      const input = makeInput(10000, -5000);

      const result = new MaximumCreditPerInvoice().computeAppliedCustomerBalance(
        input,
        configWithZeroLimit,
        mockContext
      );

      expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(0).neg());
      expect(result.appliedCustomerBalance.currency).toEqual('usd');
    });

    test('handles very large credit limit', () => {
      const configWithLargeLimit: MaximumCreditPerInvoiceConfig = {
        maximumCreditAmount: { amount: Decimal.from(1000000), currency: 'usd' },
      };
      const input = makeInput(50000, -30000);

      const result = new MaximumCreditPerInvoice().computeAppliedCustomerBalance(
        input,
        configWithLargeLimit,
        mockContext
      );

      expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(-30000));
      expect(result.appliedCustomerBalance.currency).toEqual('usd');
    });

    test('merchant support credit example - $50 credit with $20 limit', () => {
      const input = makeInput(10000, -5000);

      const result = new MaximumCreditPerInvoice().computeAppliedCustomerBalance(
        input,
        baseConfig,
        mockContext
      );

      expect(result.appliedCustomerBalance.amount).toEqual(Decimal.from(-2000));
      expect(result.appliedCustomerBalance.currency).toEqual('usd');
    });

    test('multiple small invoices can use credit up to limit each time', () => {
      const firstInvoice = makeInput(5000, -5000);

      const result1 = new MaximumCreditPerInvoice().computeAppliedCustomerBalance(
        firstInvoice,
        baseConfig,
        mockContext
      );

      expect(result1.appliedCustomerBalance.amount).toEqual(Decimal.from(-2000));
      expect(result1.appliedCustomerBalance.currency).toEqual('usd');

      const secondInvoice = makeInput(5000, -3000);

      const result2 = new MaximumCreditPerInvoice().computeAppliedCustomerBalance(
        secondInvoice,
        baseConfig,
        mockContext
      );

      expect(result2.appliedCustomerBalance.amount).toEqual(Decimal.from(-2000));
      expect(result2.appliedCustomerBalance.currency).toEqual('usd');
    });
  });
});
