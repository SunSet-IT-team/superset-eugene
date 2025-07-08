import { InfoCircleOutlined } from '@ant-design/icons';
import { styled, css } from '@superset-ui/core';
import { Tooltip } from 'antd';
import React, {
  ComponentPropsWithoutRef,
  CSSProperties,
  ElementType,
  ReactNode,
  useState,
} from 'react';

const StyledTitleSpan = styled.span`
  text-transform: uppercase;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: ${({ theme }) => theme.colors.grayscale.base};
`;

type PanelWithTooltipType<T extends ElementType = 'div'> = {
  as?: T;
  tooltip: {
    id?: string;
    title?: string;
    placement?:
      | 'top'
      | 'right'
      | 'bottom'
      | 'left'
      | 'topLeft'
      | 'topRight'
      | 'bottomLeft'
      | 'bottomRight';
    children?: ReactNode;
  };
  tooltipVisible?: boolean;
  tooltipStyles?: CSSProperties;
} & ComponentPropsWithoutRef<T>;

export const PanelWithTooltip = ({
  children,
  tooltipStyles,
  tooltipVisible = true,
  tooltip,
  as: Component = 'div',
  ...rest
}: PanelWithTooltipType) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <Component
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      {...rest}
      css={css`
        display: flex;
        gap: 7px;
        align-items: center;
        cursor: pointer;
        width: 100%;
      `}
    >
      {children}
      {showTooltip && tooltip?.title && (
        <Tooltip title="" {...tooltip} style={tooltipStyles}>
          {!tooltip?.children ? (
            <StyledTitleSpan>
              <InfoCircleOutlined />
            </StyledTitleSpan>
          ) : (
            tooltip?.children
          )}
        </Tooltip>
      )}
    </Component>
  );
};
