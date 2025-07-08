import type {DataNode} from 'antd/es/tree';
import {formatFulldesc} from '../../../../../FilterBar/utils';


export const calcSecondColWidth = (firstColWidth: number) => {
  const thirdColMinWidth = 25;

  const secondColMaxWidth = Math.max(
    20,
    100 - firstColWidth - thirdColMinWidth,
  );

  return secondColMaxWidth;
};

export const getKeys = (data: DataNode[]): (string | number)[] =>
  data.map(element => element.key);

export const generateKey = (type: string, title: string) =>
  `${type}-${title}`.replace(/\s+/g, '-').toLowerCase();

export const filterTree = (
  treeData: DataNode[],
  selectedTreeId: string,
  itemsList: string[],
  selectedTypes: string[] = [],
  selectedFilters: { [key: string]: string[] } = {},
) => {
  const mainTree = treeData.filter(node => node.key === selectedTreeId);

  const passesFiltration = node => {
    if (Object.keys(selectedFilters).length === 0) return true;
    if (!selectedFilters.hasOwnProperty(node.type)) return true;

    return Object.entries(selectedFilters).some(
      ([filterType, allowedValues]) => {
        if (
          filterType === node.type &&
          (allowedValues.length === 0 || allowedValues.includes(node.title))
        ) {
          return true;
        }
        return false;
      },
    );
  };

  const containsDeepest = node => {
    const filters = Object.entries(selectedFilters).filter(
      ([_, allowedValues]) => allowedValues.length > 0,
    );

    if (filters.length === 0) return true;

    return filters.every(([filterType, allowedValues]) => {
      if (itemsList.indexOf(filterType) < itemsList.indexOf(node.type)) {
        return true;
      }

      if (node.type === filterType) {
        return allowedValues.includes(node.title);
      }
      if (node.children.length > 0) {
        return node.children.some(containsDeepest);
      }

      return false;
    });
  };

  function filterNode(node) {
    const safeSelectedTypes = Array.isArray(selectedTypes) ? selectedTypes : [];
    const matchesTypeOrTitle =
      safeSelectedTypes.includes(node.type) ||
      safeSelectedTypes.includes(node.title);

    const branchPassedFiltration = passesFiltration(node);
    const branchContainsDeepest = containsDeepest(node);

    if (branchPassedFiltration && matchesTypeOrTitle && branchContainsDeepest) {
      const newNode = { ...node };
      if (node.children) {
        const filteredChildren = node.children
          .map(filterNode)
          .filter(Boolean)
          .flat(Infinity);

        if (filteredChildren.length > 0) {
          newNode.children = filteredChildren;
        } else {
          delete newNode.children;
        }
      }
      return newNode;
    }

    if (branchPassedFiltration && branchContainsDeepest && node.children) {
      return node.children.map(filterNode).filter(Boolean);
    }

    return null;
  }
  const res = mainTree.map(filterNode).flat(Infinity).filter(Boolean);
  return res;
};

export const transformTree = (
  filteredTree: any[],
  flag: 'basic' | 'advanced',
) => {
  if (flag === 'advanced') return filteredTree;

  const map = new Map<
    string,
    {
      type: string;
      title: string;
      fullTitle: string;
      hierarchyMode: string;
      key: string;
      ids: string[];
    }
  >();

  filteredTree.forEach(item => {
    const identifier = `${item.type}-${formatFulldesc(item.title, {
      type: 'short',
    })}`;
    const stableKey = generateKey(item.key, item.type);

    if (!map.has(identifier)) {
      const shortTitle = formatFulldesc(item.title, {
        type: 'short',
      });
      map.set(identifier, {
        type: item.type,
        title: shortTitle,
        fullTitle: shortTitle,
        hierarchyMode: 'basic',
        key: stableKey,
        ids: [item.key],
      });
    } else {
      map.get(identifier)!.ids.push(item.key);
    }
  });

  return Array.from(map.values());
};

/**
 * mockdata generator
 */

type ProductNode = {
  PROD_LEVEL: number;
  PROD_LEVEL_NAME: string;
  PROD_PARENT_TAG: string;
  PROD_TAG: string;
  PROD_NAME: string;
};

type SchemaLevel = {
  name: string; // "BRAND", "ITEM"
  count: number; // number of children at this level
};

/**
 * Generates mock hierarchical product data based on a schema.
 * @param schema - Array describing the levels of the hierarchy.
 * @param rootCount - Number of root-level entries to generate.
 * @returns Array of product nodes with hierarchy metadata.
 */
export const generateHierarchicalMockData = (
  schema: SchemaLevel[],
  rootCount = 1,
): ProductNode[] => {
  const data: ProductNode[] = [];
  let idCounter = 1;

  const getTag = (): string => `P${String(idCounter++).padStart(3, '0')}`;

  const generateLevel = (
    levelIndex: number,
    parentTag: string | null,
    parentName: string | null,
    path: string[],
  ): void => {
    const levelConfig = schema[levelIndex];
    if (!levelConfig) return;

    for (let i = 0; i < levelConfig.count; i++) {
      const tag = getTag();
      const name = `${levelConfig.name} ${i + 1}${
        parentName ? ` OF ${parentName}` : ''
      }`;
      const entry: ProductNode = {
        PROD_LEVEL: levelIndex + 1,
        PROD_LEVEL_NAME: levelConfig.name.toUpperCase(),
        PROD_PARENT_TAG: parentTag || '',
        PROD_TAG: tag,
        PROD_NAME: name,
      };

      data.push(entry);
      generateLevel(levelIndex + 1, tag, name, [...path, tag]);
    }
  };

  for (let r = 0; r < rootCount; r++) {
    generateLevel(0, null, null, []);
  }

  return data;
};

//
// const schema: SchemaLevel[] = [
//   { name: 'Category', count: 2 },
//   { name: 'Subcategory', count: 3 },
//   { name: 'Variant', count: 2 },
// ];
//
// const mockData = generateHierarchicalMockData(schema, 2);
//
