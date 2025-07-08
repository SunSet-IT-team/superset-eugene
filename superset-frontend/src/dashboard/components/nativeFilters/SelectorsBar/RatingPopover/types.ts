export interface RatingData {
  measure: string;
  count: string;
  quality: string;
  marketKey: string | undefined;
  periodKey: string | undefined;
}

export type MarketOption = {
  children: MarketOption[];
  key: string;
  title: string;
};

export type ObjectRawOption = {
  label: string | number;
  value: string | number;
  full_label?: string;
};

export type RawOption = ObjectRawOption | string | number;
export type MarketType = 'market' | 'marketAll';
