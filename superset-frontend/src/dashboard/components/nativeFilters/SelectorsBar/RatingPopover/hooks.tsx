import {useSelector} from 'react-redux';
import {prepareTreeItems} from './utils';
import {useEffect, useState} from 'react';
import {RatingData} from './types';
import {DataNode} from 'antd/lib/tree';
import {SupersetClient,} from '@superset-ui/core';
import {MARKET_TYPE} from './const';
import {selectorType} from '../../constants';
import {transformMarkets} from '../../FilterBar/utils';
import {RootState} from 'src/dashboard/types';

interface UseRatingReturn {
  ratedProducts: Array<DataNode & { checked: boolean }>;
  marketDictOptions: any[];
  periodDictOptions: any[];
  loadProducts: (
    o: RatingData,
    chosenItems: any[],
    selectionItems: any,
  ) => void;
  checkProduct: (key?: string) => void;
  loading: boolean;
  avaliableCount: number;
}

export const useRating = (chosenItemsLength?: number): UseRatingReturn => {
  const { dictOptions } = useSelector(
    state => state.selectors?.selectors?.product,
  );
  const {
    orders: { selectedValue: selectedOrder },
  } = useSelector((state: RootState) => state.orders);

  const products = prepareTreeItems(
    Array.isArray(dictOptions) ? dictOptions : [],
  );

  const { options: tempPeriodDictOptions } = useSelector(
    state => state.selectors?.selectors?.period,
  );

  const { dictOptions: tempMarketDictOptions } = useSelector(
    state => state.selectors?.selectors?.[MARKET_TYPE],
  );

  const { dashboardQuantity, options } = useSelector(
    state => state.selectors?.selectors.product,
  );
  const p = useSelector(state => state.selectors?.selectors.product);

  const [ratedProducts, setRatedProducts] = useState<
    Array<DataNode & { checked: boolean }>
  >([]);

  const [loading, setLoading] = useState(false);

  const [avaliableCount, setAvaliableCount] = useState(
    (dashboardQuantity || 0) - (chosenItemsLength || 0) || 0,
  );

  const [periodDictOptions, setPeriodDictOptions] = useState<any[]>([]);

  const [marketDictOptions, setMarketDictOptions] = useState<any[]>([]);

  const rlsRestriction = selectedOrder
    ? { column: 'order_id', value: selectedOrder.value }
    : {};

  const loadProducts = async (
    options: RatingData,
    chosenItems: any[],
    selectionItems: any,
  ) => {
    setLoading(true);
    try {
      const response = await SupersetClient.post({
        endpoint: `/api/v1/chart/raiting`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count_product: +options.count,
          fact: options.measure,
          indicator: options.quality,
          selected_market: options.marketKey,
          selected_period: options.periodKey,
          selected_product_hierarchy: chosenItems,
          rls_restriction: rlsRestriction,
          selected_options: selectionItems,
        }),
      });
      const data = await response.json.result;
      // console.log('rating data', data);

      if (Array.isArray(data)) {
        setRatedProducts(
          data.map((d, i) => ({
            key: d.prod_tag,
            title: d.prod_name,
            fullTitle: d.prod_name,
            checked: i < avaliableCount,
          })),
        );
      }

      return response.json.result;
    } catch (e) {
      // setRatedProducts(
      //   products
      //     .filter((_, i) => i < +options.count)
      //     .map((el, i) => ({
      //       key: el.value,
      //       title: el.label,
      //       fullTitle: el.label,
      //       checked: i < avaliableCount ? true : false,
      //     })),
      // );
    } finally {
      setLoading(false);
    }
  };

  const checkProduct = (key?: string) => {
    if (key) {
      return setRatedProducts(prev => {
        const noItemsLeft =
          prev.filter(e => e.checked).length >= avaliableCount;

        return prev.map(el =>
          el.key === key
            ? { ...el, checked: noItemsLeft ? false : !el.checked }
            : el,
        );
      });
    }
    return setRatedProducts(prev => {
      const allSelected = prev.length === prev.filter(p => p.checked).length;

      const noItemsLeft = prev.filter(e => e.checked).length >= avaliableCount;

      return prev.map((e, i) => ({
        ...e,
        checked: allSelected
          ? false
          : i < avaliableCount
            ? noItemsLeft
              ? false
              : true
            : false,
      }));
    });
  };

  useEffect(() => {
    if (tempMarketDictOptions?.length && tempPeriodDictOptions?.length) {
      setMarketDictOptions(tempMarketDictOptions);
      setPeriodDictOptions(tempPeriodDictOptions);
    } else {
      SupersetClient.post({
        endpoint: '/api/v1/chart/check_selectors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectors: ['Market', 'Period'],
          rls_restriction: rlsRestriction,
        }),
      }).then(res => {
        res.json?.selectors?.forEach((el: any) => {
          if (el.type_selector === selectorType.period) {
            const readyPeriods = el.avaliable_periods?.map((option: any) => ({
              ...option,
              isNotActive: !option.available,
            }));
            Array.isArray(readyPeriods) && setPeriodDictOptions(readyPeriods);
          }
          if (el.type_selector === selectorType.market) {
            const readyMarkets = transformMarkets(el.available_markets);
            Array.isArray(readyMarkets) && setMarketDictOptions(readyMarkets);
          }
        });
      });
    }
  }, []);

  useEffect(() => {
    setAvaliableCount((dashboardQuantity || 0) - (chosenItemsLength || 0));
  }, [dashboardQuantity, options, chosenItemsLength]);

  return {
    ratedProducts,
    loadProducts,
    checkProduct,
    loading,
    avaliableCount,
    periodDictOptions,
    marketDictOptions,
  };
};
