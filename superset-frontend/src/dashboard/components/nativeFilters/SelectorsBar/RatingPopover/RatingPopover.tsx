import React, { memo, useState } from 'react';
import { styled, t, useTheme } from '@superset-ui/core';
import { RatingContent } from './RatingContent';
import Button from 'src/components/Button';
import Icons from 'src/components/Icons';
import { AntdCard, AntdDropdown } from 'src/components';

interface RatingPopoverProps {
  className?: string;
  onSubmitHandler?: (selected: any[]) => void;
  chosenItems: any[];
  selectionItems: any;
  chosenProductsCount?: number;
}

const FlexDiv = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.gridUnit * 3}px;
  align-items: center;
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  justify-content: space-between;
  background: ${({ theme }) => theme.colors.grayscale.light4};
  border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light3};
`;

const StyledCloseIcon = styled(Icons.Close)`
  color: ${({ theme }) => theme.colors.grayscale.light1};
  margin-top: ${({ theme }) => theme.gridUnit}px;
  cursor: pointer;
  transition: all ease 0.3s;
  &:hover {
    color: ${({ theme }) => theme.colors.grayscale.base};
  }
`;

const Header = styled.div`
  font-size: ${({ theme }) => theme.typography.sizes.l}px;
  font-weight: ${({ theme }) => theme.typography.weights.medium};
`;

export const RatingPopover = memo(
  ({
    className,
    onSubmitHandler,
    chosenItems,
    selectionItems,
    chosenProductsCount,
  }: RatingPopoverProps) => {
    const { colors } = useTheme();

    const [opened, setOpenened] = useState(false);

    const onSubmit = (selected: any[]) => {
      setOpenened(false);
      onSubmitHandler?.(selected);
    };

    return (
      <AntdDropdown
        placement="topLeft"
        visible={opened}
        arrow
        overlay={
          opened ? (
            <AntdCard
              title={
                <FlexDiv>
                  <Header>{t('Product rating')}</Header>
                  <StyledCloseIcon
                    iconSize="l"
                    onClick={() => setOpenened(false)}
                  />
                </FlexDiv>
              }
            >
              <RatingContent
                onSubmitHandler={onSubmit}
                chosenItems={chosenItems}
                selectionItems={selectionItems}
                chosenProductsCount={chosenProductsCount}
              />
            </AntdCard>
          ) : (
            <></>
          )
        }
      >
        <Button buttonStyle="primary" onClick={() => setOpenened(true)}>
          {t('Rating')}
        </Button>
      </AntdDropdown>
    );
  },
);
