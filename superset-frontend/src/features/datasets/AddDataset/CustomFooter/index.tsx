import React from 'react';
import { useHistory } from 'react-router-dom';
import Button from 'src/components/Button';
import { SupersetClient, t } from '@superset-ui/core';
import withToasts from 'src/components/MessageToasts/withToasts';
import {
  addDangerToast,
  addSuccessToast,
} from 'src/components/MessageToasts/actions';
import { useDispatch } from 'react-redux';

interface CustomFooterProps {
  customPanelData: {
    datasetName: string;
    jsonMetadata: string;
  };
  canSave?: boolean;
}

function CustomFooter({ customPanelData, canSave }: CustomFooterProps) {
  const history = useHistory();
  const dispatch = useDispatch();

  const cancelButtonOnClick = () => {
    history.goBack();
  };

  const tooltipText = t('Select a database table.');

  const onSave = async () => {
    try {
      const res = await SupersetClient.post({
        endpoint: `/api/v1/dataset/create_json_dataset`,
        body: JSON.stringify({
          table_name: customPanelData.datasetName,
          json_payload: JSON.parse(customPanelData.jsonMetadata),
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      dispatch(addSuccessToast(t('Dataset created successfully.')));
    } catch (e) {
      dispatch(addDangerToast(t('Something went wrong.')));
    }
  };

  const CREATE_DATASET_TEXT = t('Fill dataset name and JSON');

  return (
    <>
      <Button onClick={cancelButtonOnClick}>{t('Cancel')}</Button>
      <Button
        buttonStyle="primary"
        disabled={!canSave || !customPanelData.datasetName}
        tooltip={
          !customPanelData.jsonMetadata && !customPanelData.datasetName
            ? tooltipText
            : undefined
        }
        onClick={onSave}
      >
        {CREATE_DATASET_TEXT}
      </Button>
    </>
  );
}

export default withToasts(CustomFooter);
