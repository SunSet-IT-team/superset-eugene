import React, { useRef, useState } from 'react';
import { styled } from '@superset-ui/core';

const Tooltip = styled('div')<{ maxWidth: number }>`
  position: absolute;
  background-color: ${({ theme }) => theme.colors.info.light2};
  color: ${({ theme }) => theme.colors.grayscale.dark2};
  padding: 5px 10px;
  font-weight: 400;
  z-index: 1001;
  font-size: 10px;
  width: max-content;
  max-width: 250px;
`;

const SingleValueWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const Value = styled.div<{ isBold: boolean }>`
  white-space: nowrap;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;

  ${({ isBold }) => isBold && 'font-weight: bold;'}
`;

export const SingleValue = ({
  value,
  isOnHold = false,
  isBold = false,
}: {
  value: string;
  isOnHold?: boolean;
  isBold?: boolean;
}) => {
  const ref = useRef<any>(null);
  const tooltipText = isOnHold ? `${value} (on hold)` : value;
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const handleMouseEnter = () => setTooltipVisible(true);
  const handleMouseLeave = () => setTooltipVisible(false);

  const tooltipMaxWidth = ref.current?.offsetWidth;

  return (
    <SingleValueWrapper
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Value isBold={isBold}>{value}</Value>
      {tooltipVisible && (
        <Tooltip maxWidth={tooltipMaxWidth}>{tooltipText}</Tooltip>
      )}
    </SingleValueWrapper>
  );
};
