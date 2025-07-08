import { formatFulldesc, styled, t, useTheme } from '@superset-ui/core';
import React, { useEffect, useState } from 'react';
import { memo } from 'react';
import { AntdCheckbox, AntdSelect, Divider, List } from 'src/components';
import Button from 'src/components/Button';
import { COUNT_OPTS, MARKET_TYPE, MEASURE_OPTS, QALITY_OPTS } from './const';
import { prepareTreeItems, prepareOptionsForSelector } from './utils';
import { RatingData, RawOption } from './types';
import { useRating } from './hooks';
import useEffectEvent from 'src/hooks/useEffectEvent';
import Icons from 'src/components/Icons';
import Loading from 'src/components/Loading';
import { useSelector } from 'react-redux';

interface RatingContentProps {
  className?: string;
  onSubmitHandler?: (selected: any[]) => void;
  chosenItems: any[];
  selectionItems: any;
  chosenProductsCount?: number;
}

const FlexDiv = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.gridUnit * 3}px;
  align-items: center;
  justify-content: space-between;
  margin-top: ${({ theme }) => theme.gridUnit * 2}px;
  padding: ${({ theme }) => theme.gridUnit * 2}px
    ${({ theme }) => theme.gridUnit * 4}px;
`;

const FlexEndDiv = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.gridUnit * 3}px;
  align-items: center;
  justify-content: flex-end;

  padding: ${({ theme }) => theme.gridUnit * 2}px
    ${({ theme }) => theme.gridUnit * 4}px;
`;
const Footer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.gridUnit * 3}px;
  align-items: center;
  justify-content: flex-end;
  padding: 0 ${({ theme }) => theme.gridUnit * 4}px;
  padding-bottom: ${({ theme }) => theme.gridUnit * 4}px;
`;

const InfoDiv = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: ${({ theme }) => theme.typography.sizes.m}px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.grayscale.light2};
`;
const InfoCountDiv = styled.div`
  font-size: ${({ theme }) => theme.typography.sizes.m}px;

  //   color: ${({ theme }) => theme.colors.grayscale.base};
`;

const StyledDivider = styled(Divider)`
  margin: ${({ theme }) => theme.gridUnit * 4}px 0;
`;

const StyledSelect = styled(AntdSelect)`
  && .ant-select-selector {
    border-radius: ${({ theme }) => theme.gridUnit}px;
  }
`;

export const RatingContent = memo((props: RatingContentProps) => {
  const {
    onSubmitHandler = () => {},
    chosenItems,
    chosenProductsCount,
    selectionItems,
  } = props;
  const theme = useTheme();

  const [data, setData] = useState<RatingData>({
    count: COUNT_OPTS[0].toString(),
    measure: MEASURE_OPTS[0].value as string,
    quality: QALITY_OPTS[0].toString(),
    marketKey: undefined,
    periodKey: undefined,
  });

  const [expanded, setExpanded] = useState(false);
  const [customCount, setCustomCount] = useState<undefined | number>();

  const {
    loadProducts,
    ratedProducts,
    checkProduct,
    loading,
    marketDictOptions,
    periodDictOptions,
    avaliableCount,
  } = useRating(chosenProductsCount || 0);

  const ToggleIcon = expanded
    ? Icons.FullscreenExitOutlined
    : Icons.FullscreenOutlined;

  const markets = prepareTreeItems(
    Array.isArray(marketDictOptions) ? marketDictOptions : [],
  );

  const { constructorLevel } = useSelector(
    state => state.customizeOptions.lastNOptions,
  );

  const formatTitle = (value: any) => {
    return formatFulldesc(value, constructorLevel);
  };

  const periods: RawOption[] = Array.isArray(periodDictOptions)
    ? periodDictOptions
        .filter((o: any) => o.available !== false)
        .map(opt => ({ label: opt.label, value: opt.value }))
    : [];

  const submitHandler = () => {
    onSubmitHandler(ratedProducts.filter(p => p.checked));
  };

  const renderSelector = ({
    addOpts,
    searchable = false,
    key,
    opts,
  }: {
    key: keyof RatingData;
    opts: RawOption[];
    searchable?: boolean;
    addOpts?: any;
  }) => (
    <StyledSelect
      showSearch={searchable}
      filterOption={searchable}
      optionFilterProp={searchable ? 'children' : undefined}
      size="small"
      dropdownStyle={{
        maxWidth: 400,
      }}
      dropdownMatchSelectWidth={false}
      style={{ width: 200 }}
      value={data[key]}
      onChange={v => setData(prev => ({ ...prev, [key]: v }))}
      {...(addOpts || {})}
    >
      {prepareOptionsForSelector(opts)}
    </StyledSelect>
  );

  const toggleExpand = useEffectEvent(() => {
    setExpanded(!expanded);
  });

  useEffect(() => {
    if (!data.periodKey && !data.marketKey) {
      setData(p => ({
        ...p,
        periodKey: periods[0]?.value || undefined,
        marketKey: markets[0]?.value || undefined,
      }));
    }
  }, [periods, markets]);

  return (
    <div
      style={{
        width: expanded ? '100vw' : '730px',
        height: expanded ? '100vh' : '100%',
      }}
    >
      <FlexDiv style={{ gap: 0, padding: 0, marginTop: 8 }}>
        <FlexDiv>
          <span style={{ width: 97 }}>{t('show')}</span>
          {renderSelector({
            key: 'quality',
            opts: QALITY_OPTS,
            addOpts: {
              style: { width: 130 },
            },
          })}

          {renderSelector({
            key: 'count',
            opts: customCount ? [...COUNT_OPTS, customCount] : COUNT_OPTS,
            searchable: true,
            addOpts: {
              style: { width: 80 },
              showArrow: true,
              onSelect: () => {
                setCustomCount(undefined);
              },
              onSearch: (v: any) => {
                if (!isNaN(parseInt(v))) {
                  const value = parseInt(v);
                  !COUNT_OPTS.includes(value) &&
                    value <= 1000 &&
                    setCustomCount(value);
                }
              },
            },
          })}

          <span style={{ width: 110 }}>{t('by measure')}</span>
          {renderSelector({
            key: 'measure',
            opts: MEASURE_OPTS,
            addOpts: {
              style: { width: 218 },
            },
          })}
        </FlexDiv>
        <FlexDiv>
          <span style={{ width: 97 }}>{t('on market')}</span>

          {renderSelector({
            key: 'marketKey',
            opts: markets,
            searchable: true,
            addOpts: {
              style: { width: 222 },
            },
          })}
          <span style={{ width: 110 }}>{t('of period')}</span>
          {renderSelector({
            key: 'periodKey',
            opts: periods,
            addOpts: {
              style: { width: 218 },
            },
          })}
        </FlexDiv>{' '}
      </FlexDiv>
      <FlexEndDiv>
        <Button
          buttonStyle="primary"
          loading={loading}
          disabled={!data.marketKey || !data.periodKey || loading}
          onClick={() => loadProducts(data, chosenItems, selectionItems)}
        >
          {t('Search')}
        </Button>
      </FlexEndDiv>
      <FlexDiv style={{ justifyContent: 'normal' }}>
        {Boolean(ratedProducts.length) && !loading && (
          <AntdCheckbox
            onClick={() => checkProduct()}
            checked={
              ratedProducts.length ===
              ratedProducts.filter(p => p.checked).length
            }
            indeterminate={
              ratedProducts.length !==
                ratedProducts.filter(p => p.checked).length &&
              ratedProducts.filter(p => p.checked).length > 0
            }
          />
        )}

        <InfoCountDiv>
          {t('selected')} {ratedProducts.filter(p => p.checked).length}{' '}
          {t('of')} {avaliableCount} {t('available products')}
        </InfoCountDiv>
      </FlexDiv>
      <StyledDivider />

      <List
        style={{
          height: expanded ? 'calc(100vh - 310px)' : '250px',
          overflowY: 'scroll',
        }}
      >
        {loading ? (
          <div style={{ height: '200px' }}>
            <Loading />
          </div>
        ) : ratedProducts.length ? (
          <>
            {ratedProducts.map(p => (
              <FlexDiv
                style={{
                  justifyContent: 'normal',
                  flexWrap: 'nowrap',
                  marginTop: 0,
                }}
              >
                <AntdCheckbox
                  checked={p.checked}
                  onClick={() => checkProduct(p.key)}
                />
                <div key={p.key}>{formatTitle(p.title)}</div>
              </FlexDiv>
            ))}
          </>
        ) : (
          <InfoDiv>{t('No items selected')}</InfoDiv>
        )}
      </List>
      <StyledDivider />
      <Footer>
        <Button
          disabled={!ratedProducts.length || loading}
          buttonStyle="primary"
          onClick={submitHandler}
        >
          {t('Apply')}
        </Button>
        <ToggleIcon
          iconSize="l"
          iconColor={theme.colors.grayscale.dark2}
          onClick={toggleExpand}
        />
      </Footer>
    </div>
  );
});
