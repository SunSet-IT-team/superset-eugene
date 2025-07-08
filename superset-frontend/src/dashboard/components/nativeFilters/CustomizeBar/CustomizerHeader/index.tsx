/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/* eslint-disable no-param-reassign */
import { css, styled, t, useTheme } from '@superset-ui/core';
import React, { FC } from 'react';
import { useSelector } from 'react-redux';
import Button from 'src/components/Button';
import Icons from 'src/components/Icons';
import { RootState } from 'src/dashboard/types';

const TitleArea = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    flex-direction: row;
    justify-content: space-between;
    margin: 0;
    padding: 0 ${theme.gridUnit * 2}px;

    & > span {
      font-size: ${theme.typography.sizes.l}px;
      flex-grow: 1;
      font-weight: ${theme.typography.weights.bold};
    }

    & > div:first-of-type {
      line-height: 0;
    }

    & > button > span.anticon {
      line-height: 0;
    }
  `}
`;

const HeaderButton = styled(Button)`
  padding: 0;
`;

const Wrapper = styled.div`
  ${({ theme }) => `
    padding: ${theme.gridUnit * 3}px ${theme.gridUnit * 2}px 0;

    .ant-dropdown-trigger span {
      padding-right: ${theme.gridUnit * 2}px;
    }
  `}
`;

const StyledSelectorIcon = styled(Icons.Selector)`
  color: ${({ theme }) => theme.colors.grayscale.base};
  svg {
    fill: none;
  }
`;

type HeaderProps = {
  toggleCustomizerBar: (arg0: boolean) => void;
  openSelectorsBar: () => void;
};

const CustomizerHeader: FC<HeaderProps> = ({
  toggleCustomizerBar,
  openSelectorsBar,
}) => {
  const theme = useTheme();

  return (
    <Wrapper>
      <TitleArea>
        <span>{t('Customizer')}</span>

        <HeaderButton
          buttonStyle="link"
          buttonSize="xsmall"
          onClick={() => {
            toggleCustomizerBar(false);
            openSelectorsBar();
          }}
        >
          <StyledSelectorIcon />
        </HeaderButton>
        <HeaderButton
          buttonStyle="link"
          buttonSize="xsmall"
          onClick={() => toggleCustomizerBar(false)}
        >
          <Icons.Expand iconColor={theme.colors.grayscale.base} />
        </HeaderButton>
      </TitleArea>
    </Wrapper>
  );
};

export default React.memo(CustomizerHeader);
