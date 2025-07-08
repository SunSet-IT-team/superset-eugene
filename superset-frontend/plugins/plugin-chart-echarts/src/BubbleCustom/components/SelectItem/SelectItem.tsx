import React from 'react';
import { styled, t } from '@superset-ui/core';
import Select from '../../../../../../src/components/Select/Select';

const SelectItemWrapper = styled('div')`
  display: flex;
  align-items: center;

  & > div:nth-child(2) {
    max-width: 100px;
    min-width: 70px;
    width: 100%;
  }

  &:first-child {
    margin-right: 20px;
  }
`;

const SelectTitle = styled('div')`
  flex-shrink: 0;
  font-weight: 700;
  margin-right: 10px;
`;

type PropsType = {
  title: string;
  options: { value: number; label: string }[];
  value: number;
  onSelect: (value: number) => void;
};

export const SelectItem = ({ title, options, value, onSelect }: PropsType) => {
  return (
    <SelectItemWrapper>
      <SelectTitle>{t(`${title}`)}:</SelectTitle>
      <Select
        options={options}
        onSelect={(value: unknown) => onSelect(Number(value))}
        value={value}
        allowNewOptions
      />
    </SelectItemWrapper>
  );
};

