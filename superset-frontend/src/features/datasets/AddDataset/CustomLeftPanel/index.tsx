import { useTheme } from '@emotion/react';
import { JsonEditor } from 'src/components/AsyncAceEditor';
import { memo, useState } from 'react';
import { Input } from 'src/components/Input';
import { styled, t } from '@superset-ui/core';
import { FormLabel } from 'src/components/Form';

interface CustomLeftPanelProps {
  className?: string;
  customPanelData: {
    datasetName: string;
    jsonMetadata: string;
  };
  setCustomPanelData: React.Dispatch<
    React.SetStateAction<{
      datasetName: string;
      jsonMetadata: string;
    }>
  >;
}

const StyledContainer = styled.div`
  ${({ theme }) => ` 
   display: flex;
  flex-direction: column;
  padding: ${theme.gridUnit * 4}px;
  gap: ${theme.gridUnit}px;
  `}
`;

const CustomLeftPanel = memo(
  ({
    className,
    customPanelData,
    setCustomPanelData,
  }: CustomLeftPanelProps) => {
    return (
      <StyledContainer>
        <FormLabel>{t('Dataset name')}</FormLabel>
        <Input
          placeholder={t('Enter dataset name')}
          value={customPanelData.datasetName}
          onChange={e => {
            const v = e.target?.value || '';

            setCustomPanelData(p => ({
              ...p,
              datasetName: v,
            }));
          }}
        />
        <FormLabel>{t('Dataset JSON')}</FormLabel>
        <JsonEditor
          showLoadingForImport
          name="json_metadata"
          value={customPanelData.jsonMetadata}
          onChange={(e: string) =>
            setCustomPanelData(p => ({ ...p, jsonMetadata: e || '' }))
          }
          tabSize={2}
          width="100%"
          height="320px"
          setOptions={{
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true,
            enableSnippets: true,
            showLineNumbers: true,
            tabSize: 2,
            showGutter: true,
          }}
          wrapEnabled
        />
      </StyledContainer>
    );
  },
);

export default CustomLeftPanel;
