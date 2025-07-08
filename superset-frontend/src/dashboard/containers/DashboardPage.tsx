/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, {FC, useEffect, useMemo, useRef} from 'react';
import {Global} from '@emotion/react';
import {useHistory} from 'react-router-dom';
import {CategoricalColorNamespace, getSharedLabelColor, SharedLabelColorSource, t, useTheme,} from '@superset-ui/core';
import {useDispatch, useSelector} from 'react-redux';
import {useToasts} from 'src/components/MessageToasts/withToasts';
import Loading from 'src/components/Loading';
import {useDashboard, useDashboardCharts, useDashboardDatasets,} from 'src/hooks/apiResources';
import {hydrateDashboard} from 'src/dashboard/actions/hydrate';
import {setDatasources} from 'src/dashboard/actions/datasources';
import injectCustomCss from 'src/dashboard/util/injectCustomCss';

import {LocalStorageKeys, setItem} from 'src/utils/localStorageHelpers';
import {URL_PARAMS} from 'src/constants';
import {getUrlParam} from 'src/utils/urlUtils';
import {setDatasetsStatus} from 'src/dashboard/actions/dashboardState';
import {getFilterValue, getPermalinkValue,} from 'src/dashboard/components/nativeFilters/FilterBar/keyValue';
import DashboardContainer from 'src/dashboard/containers/Dashboard';

import shortid from 'shortid';
import {triggerQuery} from 'src/components/Chart/chartAction';
import {
  resetAllParams,
  setSelectorsInfoLoaded,
  updateInitialSelectorsToGet,
  updateSelectorByKey,
  updateSelectorsToGet,
} from '../features/selectors/selectorsSlice';
import {RootState} from '../types';
import {alertNotificationStyles, chartContextMenuStyles, filterCardPopoverStyle, headerStyles,} from '../styles';
import SyncDashboardState, {getDashboardContextLocalStorage,} from '../components/SyncDashboardState';
import {getFactIds} from '../components/nativeFilters/SelectorsConfigModal/utils';
import {selectorType} from '../components/nativeFilters/constants';
import {InitialState} from '../features/selectors/types';

export const DashboardPageIdContext = React.createContext('');

const DashboardBuilder = React.lazy(
  () =>
    import(
      /* webpackChunkName: "DashboardContainer" */
      /* webpackPreload: true */
      'src/dashboard/components/DashboardBuilder/DashboardBuilder'
    ),
);

const originalDocumentTitle = document.title;

type PageProps = {
  idOrSlug: string;
};

export const DashboardPage: FC<PageProps> = ({ idOrSlug }: PageProps) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const history = useHistory();
  const dashboardPageId = useMemo(() => shortid.generate(), []);
  const hasDashboardInfoInitiated = useSelector<RootState, Boolean>(
    ({ dashboardInfo }) =>
      dashboardInfo && Object.keys(dashboardInfo).length > 0,
  );
  const { addDangerToast } = useToasts();
  const { result: dashboard, error: dashboardApiError } =
    useDashboard(idOrSlug);
  const { result: charts, error: chartsApiError } =
    useDashboardCharts(idOrSlug);
  const {
    result: datasets,
    error: datasetsApiError,
    status,
  } = useDashboardDatasets(idOrSlug);
  const isDashboardHydrated = useRef(false);

  const error = dashboardApiError || chartsApiError;
  const readyToRender = Boolean(dashboard && charts);
  const { dashboard_title, css, metadata, id = 0 } = dashboard || {};

  const chartsIds = charts?.map((chart: any) => chart.id);

  const { selectors }: InitialState = useSelector(
    (state: RootState) => state.selectors,
  );
  const { selectedDict } = selectors.facts;

  useEffect(() => {
    // mark tab id as redundant when user closes browser tab - a new id will be
    // generated next time user opens a dashboard and the old one won't be reused
    const handleTabClose = () => {
      const dashboardsContexts = getDashboardContextLocalStorage();
      setItem(LocalStorageKeys.DashboardExploreContext, {
        ...dashboardsContexts,
        [dashboardPageId]: {
          ...dashboardsContexts[dashboardPageId],
          isRedundant: true,
        },
      });
    };
    window.addEventListener('beforeunload', handleTabClose);
    return () => {
      window.removeEventListener('beforeunload', handleTabClose);
    };
  }, [dashboardPageId]);

  useEffect(() => {
    dispatch(setDatasetsStatus(status));
  }, [dispatch, status]);

  useEffect(() => {
    // eslint-disable-next-line consistent-return
    async function getDataMaskApplied() {
      const permalinkKey = getUrlParam(URL_PARAMS.permalinkKey);
      const nativeFilterKeyValue = getUrlParam(URL_PARAMS.nativeFiltersKey);
      const isOldRison = getUrlParam(URL_PARAMS.nativeFilters);

      let dataMask = nativeFilterKeyValue || {};
      // activeTabs is initialized with undefined so that it doesn't override
      // the currently stored value when hydrating
      let activeTabs: string[] | undefined;
      if (permalinkKey) {
        const permalinkValue = await getPermalinkValue(permalinkKey);
        if (permalinkValue) {
          ({ dataMask, activeTabs } = permalinkValue.state);
        }
      } else if (nativeFilterKeyValue) {
        dataMask = await getFilterValue(id, nativeFilterKeyValue);
      }
      if (isOldRison) {
        dataMask = isOldRison;
      }

      if (readyToRender) {
        if (!isDashboardHydrated.current) {
          isDashboardHydrated.current = true;
        }
        dispatch(
          hydrateDashboard({
            history,
            dashboard,
            charts,
            activeTabs,
            dataMask,
          }),
        );
        const { selector_configuration } = metadata;
        if (selector_configuration) {
          const [factsSelector] = selector_configuration.filter(
            el => el.type_selector === selectorType.facts,
          );
          let factIds = [];
          const selectorsToGet = [];

          if (factsSelector?.selected) {
            factIds = await getFactIds(
              factsSelector.selected_facts,
              factsSelector.datasource_id,
              factsSelector.datasource_type,
              factsSelector.column_name,
            );
          }
          selector_configuration.forEach((el: any) => {
            if (el.type_selector === selectorType.period) {
              if (el.selected) {
                selectorsToGet.push(selectorType.period);
              }
              dispatch(
                updateSelectorByKey({
                  key: 'period',
                  updates: {
                    isActive: el.selected,
                  },
                }),
              );
            }
            if (el.type_selector === selectorType.comparisonPeriod) {
              if (el.selected) {
                selectorsToGet.push(selectorType.comparisonPeriod);
              }
              dispatch(
                updateSelectorByKey({
                  key: 'comparisonPeriod',
                  updates: {
                    isActive: el.selected,
                  },
                }),
              );
            }
            if (el.type_selector === selectorType.market) {
              if (el.selected) {
                selectorsToGet.push(selectorType.market);
              }
              dispatch(
                updateSelectorByKey({
                  key: 'market',
                  updates: {
                    isActive: el.selected,
                    dashboardQuantity: el.max_selection || 1,
                  },
                }),
              );
            }
            if (el.type_selector === selectorType.marketAll) {
              if (el.selected) {
                selectorsToGet.push(selectorType.marketAll);
              }
              dispatch(
                updateSelectorByKey({
                  key: 'marketAll',
                  updates: {
                    isActive: el.selected,
                  },
                }),
              );
            }
            if (el.type_selector === selectorType.product) {
              if (el.selected) {
                selectorsToGet.push(selectorType.product);
              }
              dispatch(
                updateSelectorByKey({
                  key: 'product',
                  updates: {
                    isActive: el.selected,
                    dashboardQuantity: el.max_selection || 1,
                  },
                }),
              );
            }
            if (el.type_selector === selectorType.productAll) {
              if (el.selected) {
                selectorsToGet.push(selectorType.productAll);
              }
              dispatch(
                updateSelectorByKey({
                  key: 'productAll',
                  updates: {
                    isActive: el.selected,
                  },
                }),
              );
            }
            if (el.type_selector === selectorType.facts) {
              const selectedDictOptions = el.selected_facts?.map(fact => ({
                label: fact,
                value: fact,
              }));
              dispatch(
                updateSelectorByKey({
                  key: 'facts',
                  updates: {
                    isActive: el.selected,
                    dictOptions: selectedDictOptions || [],
                    options: selectedDictOptions || [],
                    selectedDict: {
                      ...selectedDict,
                      datasource_name: el.datasource_name,
                      datasource_type: el.datasource_type,
                      datasource_id: el.datasource_id,
                      column: el.column_name,
                      options_ids: factIds,
                    },
                  },
                }),
              );
            }
          });
          dispatch(updateInitialSelectorsToGet(selectorsToGet));
          dispatch(updateSelectorsToGet(selectorsToGet));
        }
        dispatch(setSelectorsInfoLoaded(true));
      }
      return null;
    }
    if (id) getDataMaskApplied();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      dispatch(resetAllParams());
      chartsIds?.forEach(id => {
        dispatch(triggerQuery(false, id));
      });
    };
  }, [readyToRender]);

  useEffect(() => {
    if (dashboard_title) {
      document.title = dashboard_title;
    }
    return () => {
      document.title = originalDocumentTitle;
    };
  }, [dashboard_title]);

  useEffect(() => {
    if (typeof css === 'string') {
      // returning will clean up custom css
      // when dashboard unmounts or changes
      return injectCustomCss(css);
    }
    return () => {};
  }, [css]);

  useEffect(() => {
    const sharedLabelColor = getSharedLabelColor();
    sharedLabelColor.source = SharedLabelColorSource.Dashboard;
    return () => {
      // clean up label color
      const categoricalNamespace = CategoricalColorNamespace.getNamespace(
        metadata?.color_namespace,
      );
      categoricalNamespace.resetColors();
      sharedLabelColor.clear();
    };
  }, [metadata?.color_namespace]);

  useEffect(() => {
    if (datasetsApiError) {
      addDangerToast(
        t('Error loading chart datasources. Filters may not work correctly.'),
      );
    } else {
      dispatch(setDatasources(datasets));
    }
  }, [addDangerToast, datasets, datasetsApiError, dispatch]);

  if (error) throw error; // caught in error boundary
  if (!readyToRender || !hasDashboardInfoInitiated) return <Loading />;

  return (
    <>
      <Global
        styles={[
          filterCardPopoverStyle(theme),
          headerStyles(theme),
          chartContextMenuStyles(theme),
          alertNotificationStyles(theme),
        ]}
      />
      <SyncDashboardState dashboardPageId={dashboardPageId} />
      <DashboardPageIdContext.Provider value={dashboardPageId}>
        <DashboardContainer>
          <DashboardBuilder />
        </DashboardContainer>
      </DashboardPageIdContext.Provider>
    </>
  );
};

export default DashboardPage;
