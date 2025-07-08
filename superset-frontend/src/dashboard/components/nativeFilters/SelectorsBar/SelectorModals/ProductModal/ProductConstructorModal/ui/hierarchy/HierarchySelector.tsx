import React from 'react';
import {StyledSelect} from 'src/components/Select/styles';
import {useTheme} from '@superset-ui/core';
import {Select as AntdSelect} from 'antd';
import {DataNode} from 'antd/es/tree';

interface HierarchySelectorProps {
  formatTitle: (value: any, options?: any) => any;
  value: string;
  onChange: (value: string, options: DataNode & { items: string[] }) => void;
  hierarchyItems: {
    label: React.ReactNode;
    key: string | number;
    value: string | number;
    items: string[];
  }[];
}
export const HierarchySelector = ({
  formatTitle,
  value,
  onChange,
  hierarchyItems,
}: HierarchySelectorProps) => {
  const theme = useTheme();
  const { Option } = AntdSelect;

  return (
    <StyledSelect
      style={{ width: '100%', flexGrow: 1 }}
      value={value}
      placeholder="Select hierarchy"
      onChange={onChange}
      optionLabelProp="label"
    >
      {hierarchyItems.map(el => (
        <Option
          key={el.key}
          items={el.items}
          value={el.key}
          label={formatTitle(el.label)}
        >
          <div style={{ textWrap: 'wrap' }}>
            {formatTitle(el.label)}
            <div
              style={{
                fontSize: theme.typography.sizes.xs,
                color: theme.colors.grayscale.light1,
                lineHeight: `${theme.typography.sizes.s}px`,
                textWrap: 'wrap',
              }}
            >
              {el.items.slice(1).map(formatTitle).join(' > ')}
            </div>
          </div>
        </Option>
      ))}
    </StyledSelect>
  );
};
