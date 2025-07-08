import { MarketType, ObjectRawOption, RawOption } from './types';

export const MARKET_TYPE: MarketType = 'market';
export const COUNT_OPTS: RawOption[] = [5, 10, 20, 50, 100, 200];
export const QALITY_OPTS: RawOption[] = ['best', 'worst'];
export const MEASURE_OPTS: ObjectRawOption[] = [
  { label: 'sales in money', value: 'money' },
  { label: 'sales in boxes', value: 'box' },
  { label: 'sales in kg/l', value: 'kgl' },
];
