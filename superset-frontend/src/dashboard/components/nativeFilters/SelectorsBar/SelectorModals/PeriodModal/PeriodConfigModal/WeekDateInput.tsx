import React, {useEffect, useRef, useState} from 'react';
import moment from 'moment';
import {DatePicker} from 'src/components/DatePicker';
import {PickerLocale} from 'antd/lib/date-picker/generatePicker';
import Button from 'src/components/Button';
import {styled, t} from '@superset-ui/core';
import {Theme} from '@emotion/react';
import Icons from 'src/components/Icons';

const CalendarContainer = styled.div`
  width: ${({ theme }) => theme.gridUnit * 123}px;
  min-height: ${({ theme }) => theme.gridUnit * 84.5}px;
  border-radius: ${({ theme }) => theme.gridUnit * 0.5}px;
  box-shadow:
    0 3px 6px -4px ${({ theme }) => theme.colors.grayscale.light4},
    0 6px 16px 0 ${({ theme }) => theme.colors.grayscale.light5},
    0 9px 28px 8px ${({ theme }) => theme.colors.grayscale.light5};
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light3};
  outline: none;
`;

const CalendarHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light3};
`;

const CalendarGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${({ theme }) => theme.gridUnit * 1.25}px;
`;

const MonthContainer = styled.div`
  width: ${({ theme }) => theme.gridUnit * 40}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${({ theme }) => theme.gridUnit * 1.25}px;
  h3 {
    cursor: pointer;
    transition: background 0.3s;
    margin: 0;
    border-radius: 2px;
    padding: ${({ theme }) => theme.gridUnit * 0.5}px
      ${({ theme }) => theme.gridUnit * 3}px;
  }
  h3: hover {
    background-color: ${({ theme }) => theme.colors.grayscale.light3};
  }
`;

const MonthTitle = styled.h3`
  cursor: pointer;
  transition: background 0.3s;
  margin: 0;
  border-radius: 2px;
  padding: ${({ theme }) => theme.gridUnit * 0.5}px
    ${({ theme }) => theme.gridUnit * 3}px;
  :hover {
    background-color: ${({ theme }) => theme.colors.grayscale.light3};
  }
`;

const WeekGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: ${({ theme }) => theme.gridUnit}px;
  max-width: ${({ theme }) => theme.gridUnit * 35}px;
`;

const WeekCell = styled.div`
  text-align: center;
  cursor: pointer;
  border-radius: 2px;
  padding: ${({ theme }) => theme.gridUnit * 0.5}px 0;
  width: ${({ theme }) => theme.gridUnit * 5.5}px;
  transition: background 0.3s;
  :hover {
    background-color: ${({ theme }) => theme.colors.grayscale.light3};
  }
`;

const YearGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${({ theme }) => theme.gridUnit * 10}px;
  margin: ${({ theme }) => theme.gridUnit * 5}px;
`;

const YearCell = styled.div`
  text-align: center;
  cursor: pointer;
  border-radius: 2px;
  padding: ${({ theme }) => theme.gridUnit * 2.5}px;
  transition: background 0.3s;
  :hover {
    background-color: ${({ theme }) => theme.colors.grayscale.light3};
  }
`;

const StyledYearButton = styled(Button)`
  margin: ${({ theme }) => theme.gridUnit}px;
  margin-left: ${({ theme }) => theme.gridUnit * 2.5}px;
  font-size: ${({ theme }) => theme.typography.sizes.m}px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  :hover {
    color: ${({ theme }) => theme.colors.primary.base};
  }
`;

const StyledCaretLeftIcon = styled(Icons.DoubleLeftOutlined)`
  margin-top: ${({ theme }) => theme.gridUnit}px;
  color: ${({ theme }) => theme.colors.grayscale.light1};
  :hover {
    color: ${({ theme }) => theme.colors.grayscale.dark1};
  }
`;

const StyledCaretRightIcon = styled(Icons.DoubleRightOutlined)`
  margin-top: ${({ theme }) => theme.gridUnit}px;
  color: ${({ theme }) => theme.colors.grayscale.light1};
  :hover {
    color: ${({ theme }) => theme.colors.grayscale.dark1};
  }
`;

interface Props {
  title: string;
  subTitle?: string;
  inputValue: Date | null;
  onChange: (value: Date) => void;
  disableDate: (current: any) => boolean;
  theme: Theme;
  locale: PickerLocale;
  currentYear?: number;
}

function WeekDateInput({
  title,
  subTitle,
  inputValue,
  onChange,
  disableDate,
  theme,
  locale,
  currentYear = moment().isoWeekYear(),
}: Props) {
  const [hoveredWeek, setHoveredWeek] = useState<string>();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(currentYear));

  const isFromDate = title === 'From';

  const months = [
    'Янв',
    'Фев',
    'Мар',
    'Апр',
    'Май',
    'Июн',
    'Июл',
    'Авг',
    'Сен',
    'Окт',
    'Ноя',
    'Дек',
  ];

  const longWeeks = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12, 13],
    [14, 15, 16, 17],
    [18, 19, 20, 21],
    [22, 23, 24, 25, 26],
    [27, 28, 29, 30],
    [31, 32, 33, 34],
    [35, 36, 37, 38, 39],
    [40, 41, 42, 43],
    [44, 45, 46, 47],
    [48, 49, 50, 51, 52, 53],
  ];

  const shortWeeks = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12, 13],
    [14, 15, 16, 17],
    [18, 19, 20, 21],
    [22, 23, 24, 25, 26],
    [27, 28, 29, 30],
    [31, 32, 33, 34],
    [35, 36, 37, 38, 39],
    [40, 41, 42, 43],
    [44, 45, 46, 47],
    [48, 49, 50, 51, 52],
  ];

  // TODO UPDATE LOGIC TO HANDLE 53th WEEK
  const weeks = shortWeeks;

  const activeStyle = {
    backgroundColor: theme.colors.primary.base,
    color: theme.colors.grayscale.light5,
  };

  const disabledStyle = {
    color: theme.colors.grayscale.light1,
    cursor: 'default',
    background: 'transparent',
  };

  const [showYearSelector, setShowYearSelector] = useState(false);

  const selectYear = newYear => {
    setYear(newYear);
    setShowYearSelector(false);
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setHoveredWeek('');
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  // TODO FIX 53th week

  const CustomPanel = () => (
    <CalendarContainer ref={containerRef}>
      <CalendarHeader>
        <Button
          buttonStyle="link"
          onClick={() => setYear(year - (showYearSelector ? 12 : 1))}
        >
          <StyledCaretLeftIcon iconSize="m" />
        </Button>
        <StyledYearButton
          buttonStyle="link"
          onClick={() => {
            setShowYearSelector(!showYearSelector);
          }}
        >
          {showYearSelector ? `${year - 5} - ${year + 6}` : year}
        </StyledYearButton>
        <Button
          onClick={() => setYear(year + (showYearSelector ? 12 : 1))}
          buttonStyle="link"
        >
          <StyledCaretRightIcon iconSize="m" />
        </Button>
      </CalendarHeader>
      {showYearSelector && (
        <YearGrid>
          {[...Array(12)].map((_, i) => (
            <YearCell
              key={i}
              onClick={() => selectYear(year - 5 + i)}
              role="button"
            >
              {year - 5 + i}
            </YearCell>
          ))}
        </YearGrid>
      )}
      {!showYearSelector && (
        <CalendarGrid>
          {months.map((month, index) => {
            const weekOfMonth =
              weeks[index][isFromDate ? 0 : weeks[index].length - 1];
            const currentWeek = moment(
              `${year}W${weekOfMonth < 10 ? '0' : ''}${weekOfMonth}`,
            );
            const available = !disableDate(currentWeek);
            return (
              <MonthContainer key={index}>
                <MonthTitle
                  onClick={() => {
                    if (available) {
                      onChange(currentWeek);
                      setOpen(false);
                    }
                  }}
                  style={
                    available
                      ? {}
                      : {
                          ...disabledStyle,
                          color: theme.colors.grayscale.dark1,
                        }
                  }
                  onMouseEnter={() =>
                    setHoveredWeek(
                      currentWeek.format(`W [${t('week of')}] GGGG`),
                    )
                  }
                  onMouseLeave={() => setHoveredWeek('')}
                >
                  {month}
                </MonthTitle>
                <WeekGrid>
                  {weeks[index].map(week => {
                    const currentWeek = moment(
                      `${year}W${week < 10 ? '0' : ''}${week}`,
                      'GGGG[W]WW',
                    );
                    const available = !disableDate(currentWeek);
                    const isActive =
                      inputValue && currentWeek.isSame(inputValue, 'week');
                    return (
                      <WeekCell
                        onClick={() => {
                          if (available) {
                            onChange(currentWeek);
                            setOpen(false);
                          }
                        }}
                        key={week}
                        style={
                          available
                            ? isActive
                              ? activeStyle
                              : {}
                            : disabledStyle
                        }
                        onMouseEnter={() => {
                          if (available) {
                            setHoveredWeek(
                              currentWeek.format(`W [${t('week of')}] GGGG`),
                            );
                          }
                        }}
                        onMouseLeave={() => setHoveredWeek('')}
                      >
                        {week}
                      </WeekCell>
                    );
                  })}
                </WeekGrid>
              </MonthContainer>
            );
          })}
        </CalendarGrid>
      )}
    </CalendarContainer>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label
        htmlFor={`${title}Picker`}
        style={{
          fontSize: `${theme.typography.sizes.m}px`,
          color: `${theme.colors.grayscale.dark1}`,
        }}
      >
        {subTitle ? `${t(title)} (${t(subTitle)})` : `${t(title)}`}
      </label>
      <div ref={inputRef}>
        <DatePicker
          id={`${title}Picker`}
          open={open}
          allowClear={false}
          onClick={() => setOpen(true)}
          style={{ width: `${theme.gridUnit * 60}px` }}
          locale={locale}
          value={inputValue}
          format={`W [${t('week of')}] GGGG`}
          panelRender={() => <CustomPanel />}
          placeholder={hoveredWeek && open ? hoveredWeek : t('Select week')}
        />
      </div>
      <Button
        disabled={!inputValue}
        buttonStyle="link"
        style={{
          alignSelf: 'end',
          fontWeight: 'normal',
          fontSize: theme.typography.sizes.xs,
        }}
        buttonSize="xsmall"
        onClick={() => {
          setHoveredWeek(t('Select week'));
          onChange(null);
        }}
      >
        {t('Clear')}
      </Button>
    </div>
  );
}

export default React.memo(WeekDateInput);
