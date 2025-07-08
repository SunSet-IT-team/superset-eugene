import React from 'react';
import { Checkbox as AntdCheckbox } from 'antd';

interface SelectAllCheckboxProps {
  itemsList: string[];
  chosenItems: string[];
  onChange: () => void;
}

export const SelectAllCheckbox = ({
  itemsList,
  chosenItems,
  onChange,
}: SelectAllCheckboxProps) => {
  const allChecked = itemsList?.every(item => chosenItems.includes(item));
  const someChecked =
    chosenItems.some(item => itemsList?.includes(item)) && !allChecked;

  return (
    <AntdCheckbox
      onChange={onChange}
      disabled={itemsList?.length === 0}
      checked={allChecked}
      indeterminate={someChecked}
    />
  );
};
