import React, { useEffect, useState } from 'react';
import { styled, css } from '@superset-ui/core';
import { fetchTimeRange } from 'src/explore/components/controls/DateFilterControl/utils/dateFilterUtils';

const FilterEl = styled.div``;

const FilterName = styled.div`
  font-weight: bold;
`;

const FilterLabel = styled.div`
  ${({ theme }) => css`
    display: block;
    border: dotted 1px ${theme.colors.grayscale.light3};
    border-radius: 10px;
    padding: 3px;
    background-color: ${theme.colors.grayscale.light5};
  `}
`;

const FilterLabelWrapper = styled.div`
  ${({ theme }) => css`
    display: block;
    border-radius: 10px;
    padding: 3px;
    background-color: ${theme.colors.grayscale.light5};
  `}
`;

export interface FilterProps {
  type: string;
  name: string;
  id: string;
  label: string;
}

const Filter = (props: FilterProps) => {
  const { type, name, id, label } = props;

  const [value, setValue] = useState<string | undefined>(label);

  useEffect(() => {
    type === 'filter_time'
      ? fetchTimeRange(label).then(data => setValue(data?.value))
      : setValue(label);
  }, [label]);

  return (
    <FilterEl id={id}>
      <FilterName>{name}</FilterName>
      <FilterLabelWrapper>
        <FilterLabel>{value}</FilterLabel>
      </FilterLabelWrapper>
    </FilterEl>
  );
};

export default Filter;