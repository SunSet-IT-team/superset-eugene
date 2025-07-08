import React from 'react';

export const CustomTextAreaControl = {
  name: 'custom_text_area',
  config: {
    type: 'TextAreaControl',
    label: 'Custom Text Area',
    default: '',
    description: 'Add custom notes or parameters',
    renderTrigger: true,
    rows: 2,
    customControl: ({ value, onChange }: any) => (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          resize: 'none', // Отключаем изменение размера
        }}
      />
    ),
  },
};
