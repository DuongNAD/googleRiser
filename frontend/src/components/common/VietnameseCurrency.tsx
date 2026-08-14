import React from 'react';
import { formatVietnameseCurrency } from '../../utils/formatting';

interface VietnameseCurrencyProps {
  amount: number;
  className?: string;
}

export const VietnameseCurrency: React.FC<VietnameseCurrencyProps> = ({ amount, className = '' }) => {
  return <span className={`font-semibold tracking-tight ${className}`}>{formatVietnameseCurrency(amount)}</span>;
};
