import React from 'react';
import {Radio as AntdRadio} from 'antd';
import {styled, useTheme} from '@superset-ui/core';

const Radio = styled(AntdRadio)`
  .ant-radio-inner::after {
    width: 9px;
    height: 9px;
    border-radius: 9px;
  }
`;

interface BasicItemProps {
  formatTitle: (value: any, options?: any) => any;
  item: string;
  isActive: boolean;
  onSelect: () => void;
}

export const BasicItem = ({
  formatTitle,
  item,
  isActive,
  onSelect,
}: BasicItemProps) => {
  const theme = useTheme();
  return (
    <div
      style={{
        marginTop: theme.gridUnit * 2,
        marginLeft: theme.gridUnit,
        display: 'flex',
        gap: theme.gridUnit,
      }}
    >
      <Radio checked={isActive} onClick={onSelect} />
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        {formatTitle(item)}
      </div>
    </div>
  );
};
