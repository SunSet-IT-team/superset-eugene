import React, { useState } from 'react';
import { styled } from '@superset-ui/core';

type PropsType = {
  title: string;
  position: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  tooltip: string;
  showDataZoomX: boolean;
  showDataZoomY: boolean;
  xAxisOffsetLeft: string;
};

const QuadrantWrapper = styled('div')<{
  position: PropsType['position'];
  showDataZoomX: PropsType['showDataZoomX'];
  showDataZoomY: PropsType['showDataZoomY'];
  xAxisOffsetLeft: PropsType['xAxisOffsetLeft'];
}>`
  z-index: 1;
  width: 200px;
  height: 30px;
  background-color: rgba(242, 242, 242, 0.5);
  color: #000000;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  cursor: pointer;

  ${({ position, showDataZoomX, showDataZoomY, xAxisOffsetLeft }) => {
    const top = '0.9rem';
    const bottom = showDataZoomX ? '7.2rem' : '3.4rem';
    const right = showDataZoomY ? '5.6rem' : '3.5rem';

    switch (position) {
      case 'topLeft':
        return `
          top: ${top};
          left: calc(${xAxisOffsetLeft}px + 3vw);
        `;
      case 'topRight':
        return `
          top: ${top};
          right: ${right};
        `;
      case 'bottomLeft':
        return `
          bottom: ${bottom};
          left: calc(${xAxisOffsetLeft}px + 3vw);
        `;
      case 'bottomRight':
        return `
          bottom: ${bottom};
          right: ${right};
        `;
      default:
        return '';
    }
  }}
`;

const Tooltip = styled('div')<{
  position: PropsType['position'];
}>`
  position: absolute;
  background-color: #ffffff;
  color: #000000;
  padding: 5px 10px;
  border-radius: 4px;
  font-weight: 400;
  z-index: 1001;
  border: 1px solid grey;
  white-space: pre-wrap;
  word-wrap: break-word;
  width: max-content;
  max-width: 350px;

  ${({ position }) => {
    switch (position) {
      case 'topLeft': {
        return `
          top: 2.5rem;
          left: 10rem;
        `;
      }
      case 'topRight':
        return `
           top: 2.5rem;
           right: 10rem;
        `;
      case 'bottomLeft':
        return `
           bottom: 2.5rem;
           left: 10rem;
        `;
      case 'bottomRight':
        return `
              bottom: 2.5rem;
              right: 10rem;
            `;
      default:
        return '';
    }
  }}
`;

export const Quadrant = ({
                           title,
                           position,
                           tooltip = '',
                           showDataZoomX,
                           showDataZoomY,
                           xAxisOffsetLeft,
                         }: PropsType) => {
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const handleMouseEnter = () => setTooltipVisible(true);
  const handleMouseLeave = () => setTooltipVisible(false);

  return (
    <div>
      <QuadrantWrapper
        position={position}
        showDataZoomX={showDataZoomX}
        showDataZoomY={showDataZoomY}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        xAxisOffsetLeft={xAxisOffsetLeft}
      >
        <span>{title}</span>
        {tooltipVisible && tooltip && (
          <Tooltip position={position}>{tooltip}</Tooltip>
        )}
      </QuadrantWrapper>
    </div>
  );
};
