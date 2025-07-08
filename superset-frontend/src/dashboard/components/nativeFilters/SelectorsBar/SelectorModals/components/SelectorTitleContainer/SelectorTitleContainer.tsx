import React, { forwardRef, useRef } from 'react';
import type { DataNode } from 'antd/es/tree';
import { t } from '@superset-ui/core';
import {
  Container,
  StyledBottomWarning,
  StyledInfoIcon,
  StyledItemTitle,
  StyledTrashIcon,
  StyledWarning,
  StyledText,
  StyledWrapper,
} from './StyledComponents';
import DraggableFilter from '../../../../FiltersConfigModal/DraggableFilter';
// import { TruncateText } from '../TruncateText/TruncateText';

interface Props {
  onChange: (id: string | number) => void;
  formatTitle: (title: string) => string;
  currentSelectorId: string;
  onRemove: (id: string | number) => void;
  checkedData: Array<DataNode & { fullTitle?: string }>;
  onRearrange: (dragIndex: number, targetIndex: number) => void;
  type: 'market' | 'product';
  maxQuantity: number;
}

const SelectorTitleContainer = forwardRef<HTMLDivElement, Props>(
  (
    {
      onChange,
      onRemove,
      currentSelectorId,
      checkedData,
      onRearrange,
      type,
      maxQuantity,
      formatTitle = v => v,
    },
    ref,
  ) => {
    const itemRef = useRef<HTMLDivElement>(null);
    const warningText = `Choose at least one ${type} from hierarchy`;
    const renderComponent = (item: DataNode & { fullTitle?: string }) => {
      const { key: id, title } = item;

      const isActive = currentSelectorId === id;
      const classNames = [];
      if (isActive) {
        classNames.push('active');
      }
      return (
        <StyledItemTitle
          role="tab"
          key={`selector-title-tab-${id}`}
          onClick={() => onChange(id)}
          className={classNames.join(' ')}
        >
          <div css={{ display: 'flex', width: '100%' }} ref={itemRef}>
            {/* TODO раскоментировать, когда будем делать подсказки */}
            {/* {type === 'product' ? ( */}
            {/*  <TruncateText */}
            {/*    text={fullTitle} */}
            {/*    maxWidth={(itemRef?.current?.clientWidth || 330) - 10} */}
            {/*  /> */}
            {/* ) : ( */}
            {/*  <StyledText>{title}</StyledText> */}
            {/* )} */}
            <StyledText>{formatTitle(title)}</StyledText>
          </div>
          <div css={{ alignSelf: 'flex-start', marginLeft: 'auto' }}>
            <StyledTrashIcon
              iconSize="xl"
              onClick={event => {
                event.stopPropagation();
                onRemove(id);
              }}
              alt={type === 'market' ? 'RemoveMarket' : 'RemoveProduct'}
            />
          </div>
        </StyledItemTitle>
      );
    };

    const renderSelectorGroups = () => {
      const items: React.ReactNode[] = [];
      checkedData.forEach((item, index) => {
        items.push(
          <DraggableFilter
            key={index}
            onRearrange={onRearrange}
            index={index}
            filterIds={[`${item.key}`]}
          >
            {renderComponent(item)}
          </DraggableFilter>,
        );
      });
      return items;
    };

    return (
      <StyledWrapper>
        <Container ref={ref}>
          {checkedData.length ? (
            renderSelectorGroups()
          ) : (
            <StyledWarning>{`! ${t(warningText)}`}</StyledWarning>
          )}
        </Container>
        <StyledBottomWarning>
          <StyledInfoIcon iconSize="l" />
          min: 1, max: {maxQuantity}
        </StyledBottomWarning>
      </StyledWrapper>
    );
  },
);

export default SelectorTitleContainer;
