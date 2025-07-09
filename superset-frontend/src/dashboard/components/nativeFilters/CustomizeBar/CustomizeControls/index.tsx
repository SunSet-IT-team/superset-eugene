import { styled, t } from '@superset-ui/core';
import { Input } from 'antd';
import React, { memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Select } from 'src/components';
import {
  renderTriggered,
  triggerQuery,
  refreshChart,
  updateQueryFormData,
} from 'src/components/Chart/chartAction';
import Checkbox from 'src/components/Checkbox';
import { InputNumber } from 'src/components/Input';
import {
  toggleOnltChartFlag,
  setShowLastNLevel,
  setNumberFormat,
} from 'src/dashboard/reducers/customizeSlice';
import { RootState } from 'src/dashboard/types';
import { PanelWithTooltip } from '../../components/PanelWithTooltip';
import { SuperChart } from '@superset-ui/core';

interface CustomizeControlsBodyProps {
  className?: string;
}

const SelectorHeader = styled.div`
  display: flex;
  gap: 5px;
  align-items: center;
  font-weight: 600;
`;
const CheckboxDiv = styled.div`
  display: flex;
  gap: 5px;
  margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
`;

const SelectorTip = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.light1};
  font-weight: 500;
  margin-bottom: 3px;
`;
const StyledDiv = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
`;

const StyledTitleBoldSpan = styled.div`
  font-size: ${({ theme }) => theme.typography.sizes.l}px;
  font-weight: bold;
  color: ${({ theme }) => theme.colors.primary.dark2};
`;

export const CustomizeControlsBody = memo(
  ({ className }: CustomizeControlsBodyProps) => {
    const dispatch = useDispatch();

    const customizeOptions = useSelector(
      (state: RootState) => state.customizeOptions.tempLastNOptions,
    );

    const typeOptions: Array<{
      value: typeof customizeOptions.constructorLevel.type;
      label: string;
    }> = [
      { value: 'custom', label: t('Last N') },
      { value: 'full', label: t('Full name') },
      { value: 'short', label: t('Short name') },
    ];

    const formBlock = (
      key: Exclude<keyof typeof customizeOptions, 'isChartsLevelOnly' | 'numberFormat'>,
      opt: typeof customizeOptions.constructorLevel,
      name: string,
    ) => (
      <StyledDiv>
        <Select
          value={opt.type}
          header={
            <>
              <SelectorHeader>{t(name)}</SelectorHeader>
              <SelectorTip>{t('Choose view type')}</SelectorTip>
            </>
          }
          onChange={v =>
            dispatch(
              setShowLastNLevel({
                key,
                type: v as any,
                customLevel: v === 'custom' ? 3 : undefined,
              }),
            )
          }
          options={typeOptions}
          placeholder={t('Select a field')}
          allowClear
        />
        {opt.type === 'custom' && (
          <>
            <SelectorTip>{t('N levels')}</SelectorTip>
            <InputNumber
              min={1}
              max={10}
              value={opt.customLevel}
              onChange={v => {
                dispatch(
                  setShowLastNLevel({
                    key,
                    type: opt.type,
                    customLevel: v ? +v : undefined,
                  }),
                );
                // setTimeout(() => {
                //   chartsIds.forEach(id =>
                //     dispatch(renderTriggered(new Date().getTime(), id)),
                //   );

                //   chartsIds.forEach(id => dispatch(triggerQuery(true, id)));
                //   chartsIds.forEach(id =>
                //     dispatch(refreshChart(id, false, dashboardId)),
                //   );
                // }, 1000);
              }}
              placeholder={t('Select level')}
            />
          </>
        )}
      </StyledDiv>
    );

    // Создаем mock данные для NumberFormatFilter
    const numberFormatFormData = {
      defaultValue: [customizeOptions.numberFormat || 'SMART_NUMBER'],
      viz_type: 'filter_numberformat',
    };

    const handleNumberFormatChange = (dataMask: any) => {
      const numberFormat = dataMask?.filterState?.value?.[0];
      dispatch(setNumberFormat(numberFormat));
    };

    return (
      <div>
        <StyledDiv>
          <PanelWithTooltip
            tooltip={{
              title: t(
                'Cusomize product title by selecting custom product level, full or short title on charts, constructor and selector',
              ),
            }}
          >
            <StyledTitleBoldSpan>
              {t('Product title settings')}
            </StyledTitleBoldSpan>
          </PanelWithTooltip>
        </StyledDiv>

        {formBlock('chartLevel', customizeOptions.chartLevel, 'Charts')}
        {/* <CheckboxDiv>
          <Checkbox
            checked={customizeOptions.isChartsLevelOnly}
            onChange={() => dispatch(toggleOnltChartFlag())}
          />
          use for all zones
        </CheckboxDiv> */}
        {!customizeOptions.isChartsLevelOnly && (
          <>
            {formBlock(
              'selectorLevel',
              customizeOptions.selectorLevel,
              'Selectors',
            )}
            {formBlock(
              'constructorLevel',
              customizeOptions.constructorLevel,
              'Constructor',
            )}
          </>
        )}

        <StyledDiv>
          <SelectorHeader>{t('Number Format')}</SelectorHeader>
          <SelectorTip>{t('Choose number format for charts')}</SelectorTip>
          <SuperChart
            height={40}
            width={0}
            chartType="filter_numberformat"
            formData={numberFormatFormData}
            queriesData={[{ data: [{}] }]} // Mock data чтобы обойти проблему с datasource
            hooks={{
              setDataMask: handleNumberFormatChange,
            }}
          />
        </StyledDiv>
      </div>
    );
  },
);
