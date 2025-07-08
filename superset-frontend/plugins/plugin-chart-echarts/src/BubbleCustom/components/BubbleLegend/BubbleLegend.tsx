import { styled } from '@superset-ui/core';
import React, { forwardRef } from 'react';

const LegendWrapper = styled('div')`
  display: flex;
  align-items: center;
  text-align: center;
  flex-wrap: wrap;
  gap: 20px;
  //margin-left: 10%;
  justify-content: center;
`;

const LegendItem = styled('div')`
  display: flex;
  align-items: center;
  text-align: center;
  max-width: fit-content;
  width: 100%;
`;

const Dot = styled('div')`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #4db9d6;
  margin-right: 10px;
`;

const ItemTitle = styled('div')``;

const LegendLine = ({
  isVertical = false,
  title,
}: {
  isVertical?: boolean;
  title: string;
}) => {
  return (
    <LegendItem>
      <div
        className={isVertical ? 'line' : ''}
        style={
          isVertical ? { transform: `rotate(90deg) translateX(15px)` } : {}
        }
      >
        <svg
          width={isVertical ? '45' : '30'}
          height={isVertical ? '19' : '15'}
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
        >
          <line
            x1="0"
            y1="10"
            x2="20"
            y2="10"
            stroke="gray"
            strokeWidth="2"
            strokeDasharray="2,2"
          />
        </svg>
      </div>
      <ItemTitle>{title}</ItemTitle>
    </LegendItem>
  );
};

type PropsType = {
  data: {
    size: string;
    yAxisValue: string;
    xAxisValue: string;
  }
};
export const BubbleLegend = forwardRef(
  ({ data: {size, xAxisValue, yAxisValue} }: PropsType, ref) => {
    return (
      // @ts-ignore
      <LegendWrapper ref={ref}>
        {size && <LegendItem>
          <Dot />
          <ItemTitle> {size} </ItemTitle>
        </LegendItem>}
        {yAxisValue && <LegendLine title={`${yAxisValue}`} />}
        {xAxisValue && <LegendLine isVertical title={`${xAxisValue}`} />}
      </LegendWrapper>
    );
  },
);
