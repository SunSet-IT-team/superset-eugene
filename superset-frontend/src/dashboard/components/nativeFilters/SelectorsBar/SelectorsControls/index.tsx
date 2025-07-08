import React from 'react';
import {Select} from 'src/components';
import {styled, t} from '@superset-ui/core';
import Icons from 'src/components/Icons';
import {useSelector} from 'react-redux';
import {formatFulldesc} from '../../FilterBar/utils';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: start;
  gap: ${({ theme }) => theme.gridUnit * 3}px;
`;

const SelectorHeader = styled.div`
  display: flex;
  gap: 5px;
  align-items: center;
  font-weight: 600;
`;

const SelectorTip = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.light1};
  font-weight: 500;
  margin-bottom: 3px;
`;

const StyledSelectorIcon = styled(Icons.Selector)`
  color: ${({ theme }) => theme.colors.grayscale.base};
  svg {
    fill: none;
  }
`;

const SelectorHeaderWithIcon = ({ label }) => (
  <SelectorHeader>
    <StyledSelectorIcon iconSize="l" />
    {label}
  </SelectorHeader>
);

const SelectorQuantityTip = ({ quantity }) => {
  if (quantity > 1) {
    return (
      <SelectorTip>{`${t('Choose up to')} ${quantity} ${t(
        'variants',
      )}`}</SelectorTip>
    );
  }
  return (
    <SelectorTip>{`${t('Choose')} ${quantity} ${t('variant')}`}</SelectorTip>
  );
};

const SelectorsControls = ({ selectors, updateSelected }) => {
  const lastNOptions = useSelector(
    state => state.customizeOptions.lastNOptions,
  );

  const formatTitle = (value: any) => {
    const { isChartsLevelOnly, chartLevel, selectorLevel } = lastNOptions;
    return formatFulldesc(
      value,
      // isChartsLevelOnly ? chartLevel : selectorLevel,
      selectorLevel,
    );
  };

  const mappedSelectors = Object.entries(selectors).map(([key, selector]) => {
    const limitedOptions = selector?.options
      ?.map(opt => ({
        ...opt,
        label: formatTitle(
          ['product', 'productAll'].includes(key) ? opt.title : opt.label,
        ),
        title: formatTitle(opt.title),
      }))
      .map(option => ({
        ...option,
        disabled:
          (selector.dashboardQuantity > 1 &&
            selector.selectedOptions?.length >= selector.dashboardQuantity &&
            !selector.selectedOptions
              .map(opt => opt.value)
              .includes(option.value)) ||
          option.isNotActive,
      }));
    const ModalLink = selector.settingsModal;

    return selector.isActive ? (
      <Select
        key={key}
        mode={selector.dashboardQuantity > 1 ? 'multiple' : 'single'}
        value={
          Array.isArray(selector.selectedOptions)
            ? selector.selectedOptions?.map(opt => opt.value)
            : selector.selectedOptions?.value
        }
        header={
          ModalLink ? (
            <>
              <ModalLink modalType={selector.settingsModalType}>
                <SelectorHeaderWithIcon label={t(selector.name)} />
              </ModalLink>
              <SelectorQuantityTip quantity={selector.dashboardQuantity} />
            </>
          ) : (
            <>
              <SelectorHeader>{t(selector.name)}</SelectorHeader>
              <SelectorQuantityTip quantity={selector.dashboardQuantity} />
            </>
          )
        }
        onChange={(_, option) => {
          updateSelected(key, option);
        }}
        options={limitedOptions}
        allowSelectAll={false}
        allowSelectFirstN={['market', 'product'].indexOf(key) > -1}
        selectFirstNCount={selector.dashboardQuantity}
        maxTagCount={3}
        placeholder={t('Select a field')}
        allowClear
      />
    ) : null;
  });

  return <Wrapper>{mappedSelectors}</Wrapper>;
};

export default SelectorsControls;
