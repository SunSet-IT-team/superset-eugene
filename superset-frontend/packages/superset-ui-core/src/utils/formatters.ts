//TODO: delete duplicate
export function formatFulldesc(
  unFormattedValue: string,
  options?: {
    type: 'full' | 'short' | 'custom';
    customLevel?: number;
  },
) {
  if (typeof unFormattedValue !== 'string') return unFormattedValue;

  let value = unFormattedValue;

  if (unFormattedValue.split('|<--|').length) {
    value = unFormattedValue.split('|<--|')[0];
  }

  if (typeof value !== 'string') return value;

  const separator = localStorage.getItem('sep_func_separator') || '|-|';
  const joiner = localStorage.getItem('sep_func_joiner') || ' ';
  const storageLevels = localStorage.getItem('sep_func_level')
    ? +localStorage.getItem('sep_func_level')
    : 1;

  const splitedValues = value.toString().split(separator);

  if (!options || options.type === 'full') return splitedValues.join(joiner);

  if (options.type === 'short') return splitedValues[splitedValues.length - 1];
  if (options.type === 'custom')
    return splitedValues
      .reverse()
      .filter((_, i) => i < (options.customLevel || storageLevels))
      .reverse()
      .join(joiner);

  return value;
}

export function getXAxisCategoryFormatter(
  useFormat?: boolean,
  options?: any,
): StringConstructor | undefined {
  if (useFormat) {
    return value => formatFulldesc(value, options);
  }

  return String;
}
