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

/* eslint-disable no-param-reassign */
import { FeatureFlag, isFeatureEnabled, styled, t } from '@superset-ui/core';
import cx from 'classnames';
import { throttle } from 'lodash';
import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { EmptyStateSmall } from 'src/components/EmptyState';
import Icons from 'src/components/Icons';
import Loading from 'src/components/Loading';
import SelectorsControls from '../SelectorsBar/SelectorsControls';
import CrossFiltersVertical from './CrossFilters/Vertical';
import FilterControls from './FilterControls/FilterControls';
import Header from './Header';
import SelectorsHeader from '../SelectorsBar/SelectorsHeader';
import { VerticalBarProps } from './types';
import { getFilterBarTestId } from './utils';
import CustomizerHeader from '../CustomizeBar/CustomizerHeader';
import { CustomizeControlsBody } from '../CustomizeBar/CustomizeControls';

const BarWrapper = styled.div<{ width: number }>`
  width: ${({ theme }) => theme.gridUnit * 8}px;

  & .ant-tabs-top > .ant-tabs-nav {
    margin: 0;
  }
  &.open {
    width: ${({ width }) => width}px; // arbitrary...
  }
`;

const Bar = styled.div<{ width: number }>`
  ${({ theme, width }) => `
    & .ant-typography-edit-content {
      left: 0;
      margin-top: 0;
      width: 100%;
    }
    position: absolute;
    top: 0;
    left: 0;
    flex-direction: column;
    flex-grow: 1;
    width: ${width}px;
    background: ${theme.colors.grayscale.light5};
    border-right: 1px solid ${theme.colors.grayscale.light2};
    border-bottom: 1px solid ${theme.colors.grayscale.light2};
    min-height: 100%;
    display: none;
    &.open {
      display: flex;
    }
  `}
`;

const CollapsedBar = styled.div<{ offset: number }>`
  ${({ theme, offset }) => `
    position: absolute;
    top: ${offset}px;
    left: 0;
    height: 100%;
    width: ${theme.gridUnit * 8}px;
    padding-top: ${theme.gridUnit * 2}px;
    display: none;
    text-align: center;
    &.open {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: ${theme.gridUnit * 2}px;
    }
    svg {
      cursor: pointer;
    }
  `}
`;

const StyledCollapseIcon = styled(Icons.Collapse)`
  ${({ theme }) => `
    color: ${theme.colors.primary.base};
    margin-bottom: ${theme.gridUnit * 3}px;
  `}
`;

const StyledFilterIcon = styled(Icons.Filter)`
  color: ${({ theme }) => theme.colors.grayscale.base};
  margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
`;

const StyledSelectorIcon = styled(Icons.Selector)`
  color: ${({ theme }) => theme.colors.grayscale.base};
  margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
  svg {
    fill: none;
  }
`;
const StyledCustomizerIcon = styled(Icons.Edit)`
  color: ${({ theme }) => theme.colors.grayscale.base};
  margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
  svg {
    fill: none;
  }
`;

const FilterBarEmptyStateContainer = styled.div`
  margin-top: ${({ theme }) => theme.gridUnit * 8}px;
`;

const FilterControlsWrapper = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  // 108px padding to make room for buttons with position: absolute
  padding-bottom: ${({ theme }) => theme.gridUnit * 27}px;
`;

const SelectorsControlsWrapper = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  padding-bottom: ${({ theme }) => theme.gridUnit * 27}px;
`;

export const FilterBarScrollContext = createContext(false);
const VerticalFilterBar: React.FC<VerticalBarProps> = ({
  filterActions,
  selectorActions,
  customizeActions,
  canEdit,
  dataMaskSelected,
  filtersOpen,
  selectorsOpen,
  customizerOpen,
  filterValues,
  height,
  isInitialized,
  offset,
  onSelectionChange,
  toggleFiltersBar,
  toggleSelectorsBar,
  toggleCustomizerBar,
  width,
  selectors,
  updateSelected,
}) => {
  const [isScrolling, setIsScrolling] = useState(false);
  const timeout = useRef<any>();

  const openFiltersBar = useCallback(
    () => toggleFiltersBar(true),
    [toggleFiltersBar],
  );

  const openSelectorsBar = useCallback(
    () => toggleSelectorsBar(true),
    [toggleSelectorsBar],
  );
  const openCustomizerBar = useCallback(
    () => toggleCustomizerBar(true),
    [toggleCustomizerBar],
  );

  const onScroll = useMemo(
    () =>
      throttle(() => {
        clearTimeout(timeout.current);
        setIsScrolling(true);
        timeout.current = setTimeout(() => {
          setIsScrolling(false);
        }, 300);
      }, 200),
    [],
  );

  useEffect(() => {
    document.onscroll = onScroll;
    return () => {
      document.onscroll = null;
    };
  }, [onScroll]);

  const tabPaneStyle = useMemo(
    () => ({ overflow: 'auto', height, overscrollBehavior: 'contain' }),
    [height],
  );

  const selectorsControls = useMemo(
    () =>
      Object.keys(selectors).length === 0 ? (
        <FilterBarEmptyStateContainer>
          <EmptyStateSmall
            title={t('No selectors are currently added')}
            image="filter.svg"
            description={
              canEdit &&
              t(
                'Click on "+Add/Edit Selectors" button to create new dashboard selectors',
              )
            }
          />
        </FilterBarEmptyStateContainer>
      ) : (
        <SelectorsControlsWrapper>
          <SelectorsControls
            selectors={selectors}
            updateSelected={updateSelected}
          />
        </SelectorsControlsWrapper>
      ),
    [canEdit, selectors],
  );

  const customizerControls = useMemo(
    () => (
      <SelectorsControlsWrapper>
        <CustomizeControlsBody />
      </SelectorsControlsWrapper>
    ),
    [],
  );

  const filterControls = useMemo(
    () =>
      filterValues.length === 0 ? (
        <FilterBarEmptyStateContainer>
          <EmptyStateSmall
            title={t('No global filters are currently added')}
            image="filter.svg"
            description={
              canEdit &&
              t(
                'Click on "+Add/Edit Filters" button to create new dashboard filters',
              )
            }
          />
        </FilterBarEmptyStateContainer>
      ) : (
        <FilterControlsWrapper>
          <FilterControls
            dataMaskSelected={dataMaskSelected}
            onFilterSelectionChange={onSelectionChange}
          />
        </FilterControlsWrapper>
      ),
    [canEdit, dataMaskSelected, filterValues.length, onSelectionChange],
  );

  const crossFilters = useMemo(
    () =>
      isFeatureEnabled(FeatureFlag.DashboardCrossFilters) ? (
        <CrossFiltersVertical />
      ) : null,
    [],
  );

  return (
    <FilterBarScrollContext.Provider value={isScrolling}>
      <BarWrapper
        {...getFilterBarTestId()}
        className={cx({ open: filtersOpen || selectorsOpen })}
        width={width}
      >
        <CollapsedBar
          {...getFilterBarTestId('collapsable')}
          className={cx({ open: !filtersOpen && !selectorsOpen })}
          offset={offset}
        >
          {/* <StyledCollapseIcon
            {...getFilterBarTestId('expand-button')}
            iconSize="l"
            onClick={openFiltersBar}
          /> */}
          <StyledSelectorIcon
            {...getFilterBarTestId('selector-icon')}
            iconSize="l"
            onClick={openSelectorsBar}
          />
          <StyledFilterIcon
            {...getFilterBarTestId('filter-icon')}
            iconSize="l"
            onClick={openFiltersBar}
          />
          <StyledCustomizerIcon
            {...getFilterBarTestId('edit-icon')}
            iconSize="l"
            onClick={openCustomizerBar}
          />
        </CollapsedBar>
        <Bar className={cx({ open: filtersOpen })} width={width}>
          <Header toggleFiltersBar={toggleFiltersBar} />
          {!isInitialized ? (
            <div css={{ height }}>
              <Loading />
            </div>
          ) : (
            <div css={tabPaneStyle} onScroll={onScroll}>
              <>
                {crossFilters}
                {filterControls}
              </>
            </div>
          )}
          {filterActions}
        </Bar>
        <Bar className={cx({ open: selectorsOpen })} width={width}>
          <SelectorsHeader
            toggleSelectorsBar={toggleSelectorsBar}
            openCustomizerBar={openCustomizerBar}
          />
          {!isInitialized ? (
            <div css={{ height }}>
              <Loading />
            </div>
          ) : (
            <div css={tabPaneStyle} onScroll={onScroll}>
              {selectorsControls}
            </div>
          )}
          {selectorActions}
        </Bar>
        <Bar className={cx({ open: customizerOpen })} width={width}>
          <CustomizerHeader
            toggleCustomizerBar={toggleCustomizerBar}
            openSelectorsBar={openSelectorsBar}
          />
          {!isInitialized ? (
            <div css={{ height }}>
              <Loading />
            </div>
          ) : (
            <div css={tabPaneStyle} onScroll={onScroll}>
              {customizerControls}
            </div>
          )}
          {customizeActions}
        </Bar>
      </BarWrapper>
    </FilterBarScrollContext.Provider>
  );
};
export default React.memo(VerticalFilterBar);
