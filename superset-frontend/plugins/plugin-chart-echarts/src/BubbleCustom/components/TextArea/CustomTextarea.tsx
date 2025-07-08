import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Control from '../../../../../../src/explore/components/Control';
import { supersetActions } from '../../../custom/actions/supersetActions';
import { setControlValue } from '../../../../../../src/explore/actions/exploreActions';
import { debounce } from 'lodash';

export const CustomTextarea = ({ description = '', name = '' }) => {
  const state = useSelector(state => state);
  const formData = state.explore.form_data;

  const dispatch = useDispatch();

  const onChange = (value: string) => {
    dispatch(setControlValue(name, value.trim()));
  };

  const debouncedOnChange = debounce(onChange, 500);

  return (
    <>
      <Control
        // @ts-ignore
        initialValue={formData[name] || ''}
        label={name}
        name={name}
        type="TextAreaControl"
        actions={supersetActions}
        description={description}
        placeholder={name}
        resize={null}
        onChange={debouncedOnChange}
        height={20}
        renderTrigger
      />
    </>
  );
};
