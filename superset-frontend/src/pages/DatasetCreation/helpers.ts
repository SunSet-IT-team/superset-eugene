const SEARCHABLE_KEYS = ['Rows', 'Columns', 'Facts'];

export const validateJson = (jsonMetadata: string): boolean => {
  try {
    const json = JSON.parse(jsonMetadata);
    const keysInJSON = SEARCHABLE_KEYS.every(key =>
      Object.keys(json).includes(key),
    );

    if (!keysInJSON) return false;

    return true;
  } catch (e) {
    return false;
  }
};

export const formColumns = (json: string) => {
  let parsedJSON: Record<string, string[]> = {};

  try {
    parsedJSON = JSON.parse(json);
  } catch (e) {
    return [];
  }

  if (typeof parsedJSON !== 'object') return [];

  const foundCols = Object.keys(parsedJSON).filter(key =>
    SEARCHABLE_KEYS.includes(key),
  );

  return foundCols
    .map(key =>
      parsedJSON[key].map(name => ({
        name,
        type: key,
      })),
    )
    .flat();
};
