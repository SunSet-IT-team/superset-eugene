import React from 'react';
import { styled } from '@superset-ui/core';
import { OptionType } from '../../../dashboard/reducers/ordersSlice';

const LabelWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const OnHold = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.grayscale.light1};
  min-width: fit-content;
`;

const Label = styled.span``;

export const OrderLabel = (option: OptionType) => (
  <LabelWrapper>
    <Label>{option.label}</Label>
    <OnHold>• On hold</OnHold>
  </LabelWrapper>
);
