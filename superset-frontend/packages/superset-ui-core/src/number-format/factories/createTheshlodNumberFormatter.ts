import { format as d3Format } from 'd3-format';
import NumberFormatter from '../NumberFormatter';
import NumberFormats from '../NumberFormats';

// Формат для tooltip: преобразовываем числа согласно логике
const siFormatter = d3Format('.3~s');
const float2PointFormatter = d3Format('.2~f');
const float4PointFormatter = d3Format('.4~f');

function formatValue(value: number) {
  if (value === 0) {
    return '0';
  }
  const absoluteValue = Math.abs(value);
  let formattedValue = '';

  if (absoluteValue >= 1000) {
    if (absoluteValue >= 1e12) {
      const trillions = value / 1e12;
      formattedValue =
        trillions % 1 === 0 ? `${trillions}T` : `${d3Format(',.2f')(trillions)}T`;
    } else if (absoluteValue >= 1e9) {
      const billions = value / 1e9;
      formattedValue =
        billions % 1 === 0 ? `${billions}B` : `${d3Format(',.2f')(billions)}B`;
    } else if (absoluteValue >= 1e6) {
      const millions = value / 1e6;
      formattedValue =
        millions % 1 === 0 ? `${millions}M` : `${d3Format(',.2f')(millions)}M`;
    } else if (absoluteValue >= 1e3) {
      const thousands = value / 1e3;
      formattedValue =
        thousands % 1 === 0 ? `${thousands}K` : `${d3Format(',.2f')(thousands)}K`;
    } else {
      formattedValue = siFormatter(value);
    }
    return formattedValue
      .replace(',', ' ')
      .replace('T', ' трлн')
      .replace('B', ' млрд')
      .replace('M', ' млн')
      .replace('K', ' тыс');
  }
  if (absoluteValue >= 1) {
    return float2PointFormatter(value);
  }
  if (absoluteValue >= 0.001) {
    return float4PointFormatter(value);
  }
  if (absoluteValue > 0.000001) {
    return `${siFormatter(value * 1000000)}µ`;
  }
  return siFormatter(value);
}

export default function createThresholdNumberFormatter(
  config: {
    description?: string;
    signed?: boolean;
    id?: string;
    label?: string;
  } = {},
  context: 'axis' | 'tooltip' = 'axis',
) {
  const { description, signed = false, id, label } = config;
  const getSign = signed ? (value: number) => (value > 0 ? '+' : '') : () => '';

  return new NumberFormatter({
    description,
    formatFunc: value => `${getSign(value)}${formatValue(value)}`,
    id: id || signed ? NumberFormats.SMART_NUMBER_SIGNED : NumberFormats.SMART_NUMBER,
    label: label ?? 'Adaptive formatter',
  });
}