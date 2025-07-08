import { formatFulldesc } from './formatters';

// Сортирует массив в порядке, определенном в другом массиве
export function sortByOrder<T>(sourceArray: T[], orderArray: T[]): T[] {
  // Создаем карту для быстрого определения порядка элементов
  const orderMap = new Map<T, number>();
  orderArray.forEach((item, index) => {
    orderMap.set(item, index);
  }); // Сортируем первый массив

  return [...sourceArray].sort((a, b) => {
    const aIndex = orderMap.has(a) ? orderMap.get(a)! : Infinity;
    const bIndex = orderMap.has(b) ? orderMap.get(b)! : Infinity;

    // Сначала сортируем по порядку во втором массиве,
    // затем оставляем исходный порядок для элементов не из orderArray
    return aIndex - bIndex || sourceArray.indexOf(a) - sourceArray.indexOf(b);
  });
}

const findSortKey = (currentArr: string[], map: Record<string, string[]>) =>
  Object.keys(map).find(k =>
    currentArr.every(e => map[k]?.some((el: string) => el.includes(e))),
  );

// Вспомогательная функция сортировки любого массива по значениям селектора
export function sortBySelector(
  currentArr: string[],
  map: Record<string, string[]>,
): string[] {
  const selectorArrKey = Object.keys(map).find(k =>
    currentArr.every(e => map[k]?.some((el: string) => el.includes(e))),
  );

  const orderedArray = selectorArrKey
    ? map[selectorArrKey].map((el: String) =>
        currentArr.find(e => el?.includes(e) || ''),
      )
    : [];

  return sortByOrder(currentArr, orderedArray);
}

export const findInCols = (
  rows: Record<string, any>[],
  map: Record<string, string[]>,
) => {
  if (!Array.isArray(rows) || !rows.length) return rows;

  if (!map || !Array.isArray(Object.keys(map)) || !Object.keys(map).length)
    return rows;
  let formedMap: Record<string, string[]> = {};
  Object.keys(map).map(k => {
    formedMap[k] = map[k].map(el => formatFulldesc(el, { type: 'short' }));
  });

  let dataObj: any = {};

  const firstRowKeys = Object.keys(rows[0] || {});

  firstRowKeys.map(k => (dataObj[k] = []));
  rows.forEach(r =>
    Object.keys(r).map(k =>
      dataObj[k].push(formatFulldesc(r[k], { type: 'short' })),
    ),
  );

  const foundKeys = Object.keys(dataObj).map(k =>
    findSortKey(dataObj[k], formedMap),
  );

  const foundKey = foundKeys.find(Boolean);

  if (!foundKey) return rows;
  const foundKeyIndex = foundKeys.indexOf(foundKey);

  const foundDataKey = firstRowKeys[foundKeyIndex];

  if (!foundDataKey) return rows;

  const res = rows
    .map(r => ({
      ...r,
      order: formedMap[foundKey].indexOf(
        formatFulldesc(r[foundDataKey], { type: 'short' }),
      ),
    }))
    .sort((a, b) => a.order - b.order);

  res.forEach(o => delete o['order']);
  return res;
};
