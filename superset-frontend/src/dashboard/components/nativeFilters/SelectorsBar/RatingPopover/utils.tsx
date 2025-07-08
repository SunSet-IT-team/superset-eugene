import { css, t } from '@superset-ui/core';
import { MarketOption, ObjectRawOption, RawOption } from './types';
import { AntdSelect } from 'src/components';
import {
  AvailableMarketsType,
  MarketHierarchyType,
} from '../../FilterBar/types';

export const transformToOpts = (arr: Array<RawOption>): ObjectRawOption[] =>
  arr.map(el =>
    typeof el === 'object'
      ? {
          label: t(el.label.toString()),
          value: el.value,
          full_label: el.full_label
            ? t(el.full_label.toString())
            : t(el.label.toString()),
        }
      : { label: t(el.toString()), value: el },
  );

const transformToSelectOpts = (arr: ObjectRawOption[]) =>
  arr.map(el => (
    <AntdSelect.Option title={el.full_label} value={el.value}>
      {el.label}
    </AntdSelect.Option>
  ));

export const prepareOptionsForSelector = (arr: Array<RawOption>) =>
  transformToSelectOpts(transformToOpts(arr));

export const prepareTreeItems = (
  markets: MarketOption[],
  titleName = 'title',
  keyName = 'key',
  parentLabel?: string,
): ObjectRawOption[] =>
  markets
    .map(market => [
      {
        full_label: parentLabel
          ? `${parentLabel}/${market.title}`
          : market.title,
        label: market.title,
        value: market.key,
      },
      ...prepareTreeItems(
        market.children || [],
        titleName,
        keyName,
        parentLabel ? `${parentLabel}/${market.title}` : market.title,
      ),
    ])
    .flat();
