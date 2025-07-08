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
import { t } from '@superset-ui/core';
import {
  ControlPanelConfig,
  formatSelectOptions,
  sections,
  ControlPanelsContainerProps,
  sharedControls,
} from '@superset-ui/chart-controls';
import { DEFAULT_FORM_DATA } from './constants';
import {
  customBubbleLegendSection,
  truncateXAxis,
  xAxisBounds,
  xAxisLabelRotation,
} from '../controls';
import { defaultYAxis } from '../defaults';

const { logAxis, truncateYAxis, yAxisBounds, opacity } = DEFAULT_FORM_DATA;

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['series'],
        ['entity'],
        ['x'],
        ['y'],
        ['adhoc_filters'],
        ['size'],
        ['orderby'],
        [
          {
            name: 'order_desc',
            config: {
              ...sharedControls.order_desc,
              visibility: ({ controls }) => Boolean(controls.orderby.value),
            },
          },
        ],
        [
          {
            name: 'dotted_x_axis',
            config: {
              ...sharedControls.dottedX,
            },
          },
        ],
        [
          {
            name: 'dotted_y_axis',
            config: {
              ...sharedControls.dottedY,
            },
          },
        ],
        ['row_limit'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      tabOverride: 'customize',
      controlSetRows: [
        // [
        //   {
        //     name: 'x_axis_line_value',
        //     config: {
        //       type: 'TextControl',
        //       label: t('X Axis Line Value'),
        //       renderTrigger: true,
        //       default: '',
        //       description: t('Enter a value for drawing a dashed line on the X axis.'),
        //     },
        //   },
        // ],
        ['color_scheme'],
        ...customBubbleLegendSection,
        [
          {
            name: 'max_bubble_size',
            config: {
              type: 'SelectControl',
              renderTrigger: true,
              freeForm: true,
              label: t('Max Bubble Size'),
              default: '25',
              choices: formatSelectOptions([
                '5',
                '10',
                '15',
                '25',
                '50',
                '75',
                '100',
              ]),
            },
          },
        ],
        [
          {
            name: 'tooltipSizeFormat',
            config: {
              ...sharedControls.y_axis_format,
              label: t('Bubble size number format'),
            },
          },
        ],
        [
          {
            name: 'opacity',
            config: {
              type: 'SliderControl',
              label: t('Bubble Opacity'),
              renderTrigger: true,
              min: 0,
              max: 1,
              step: 0.1,
              default: opacity,
              description: t(
                'Opacity of bubbles, 0 means completely transparent, 1 means opaque',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('X Axis'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'x_axis_label',
            config: {
              type: 'TextControl',
              label: t('X Axis Title'),
              renderTrigger: true,
              default: '',
            },
          },
        ],
        [xAxisLabelRotation],
        [
          {
            name: 'x_axis_title_margin',
            config: {
              type: 'SelectControl',
              freeForm: true,
              clearable: true,
              label: t('X AXIS TITLE MARGIN'),
              renderTrigger: true,
              default: sections.TITLE_MARGIN_OPTIONS[1],
              choices: formatSelectOptions(sections.TITLE_MARGIN_OPTIONS),
            },
          },
        ],
        [
          {
            name: 'xAxisFormat',
            config: {
              ...sharedControls.y_axis_format,
              label: t('X Axis Format'),
            },
          },
        ],
        [
          {
            name: 'logXAxis',
            config: {
              type: 'CheckboxControl',
              label: t('Logarithmic x-axis'),
              renderTrigger: true,
              default: logAxis,
              description: t('Logarithmic x-axis'),
            },
          },
        ],
      ],
    },
    {
      label: t('Y Axis'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'y_axis_label',
            config: {
              type: 'TextControl',
              label: t('Y Axis Title'),
              renderTrigger: true,
              default: '',
            },
          },
        ],
        [
          {
            name: 'yAxisLabelRotation',
            config: {
              type: 'SelectControl',
              freeForm: true,
              clearable: false,
              label: t('Rotate y axis label'),
              choices: [
                [0, '0°'],
                [45, '45°'],
              ],
              default: defaultYAxis.yAxisLabelRotation,
              renderTrigger: true,
              description: t(
                'Input field supports custom rotation. e.g. 30 for 30°',
              ),
            },
          },
        ],
        [
          {
            name: 'y_axis_title_margin',
            config: {
              type: 'SelectControl',
              freeForm: true,
              clearable: true,
              label: t('Y AXIS TITLE MARGIN'),
              renderTrigger: true,
              default: sections.TITLE_MARGIN_OPTIONS[1],
              choices: formatSelectOptions(sections.TITLE_MARGIN_OPTIONS),
            },
          },
        ],
        ['y_axis_format'],
        [
          {
            name: 'logYAxis',
            config: {
              type: 'CheckboxControl',
              label: t('Logarithmic y-axis'),
              renderTrigger: true,
              default: logAxis,
              description: t('Logarithmic y-axis'),
            },
          },
        ],
        [truncateXAxis],
        [xAxisBounds],
        [
          {
            name: 'truncateYAxis',
            config: {
              type: 'CheckboxControl',
              label: t('Truncate Y Axis'),
              default: truncateYAxis,
              renderTrigger: true,
              description: t(
                'Truncate Y Axis. Can be overridden by specifying a min or max bound.',
              ),
            },
          },
        ],
        [
          {
            name: 'y_axis_bounds',
            config: {
              type: 'BoundsControl',
              label: t('Y Axis Bounds'),
              renderTrigger: true,
              default: yAxisBounds,
              description: t(
                'Bounds for the Y-axis. When left empty, the bounds are ' +
                  'dynamically defined based on the min/max of the data. Note that ' +
                  "this feature will only expand the axis range. It won't " +
                  "narrow the data's extent.",
              ),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                Boolean(controls?.truncateYAxis?.value),
            },
          },
        ],
      ],
    },
    {
      label: t('Quadrant title'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'show_swot_headers',
            config: {
              type: 'CheckboxControl',
              label: t('SHOW'),
              renderTrigger: true,
              default: false,
              description: t('Show SWOT headers in chart'),
            },
          },
        ],
        [
          {
            name: 'Text tooltip for header 1',
            config: {
              ...sharedControls.textArea,
              label: t('Text tooltip for header 1'),
              description: t('Header 1 is «Возможности»'),
            },
          },
        ],
        [
          {
            name: 'Text tooltip for header 2',
            config: {
              ...sharedControls.textArea,
              label: t('Text tooltip for header 2'),
              description: t('Header 2 is «Сильные стороны»'),
            },
          },
        ],
        [
          {
            name: 'Text tooltip for header 3',
            config: {
              ...sharedControls.textArea,
              name: 'Text tooltip for header 3',
              label: t('Text tooltip for header 3'),
              description: t('Header 3 is «Угрозы»'),
            },
          },
        ],
        [
          {
            name: 'Text tooltip for header 4',
            config: {
              ...sharedControls.textArea,
              name: 'Text tooltip for header 4',
              label: t('Text tooltip for header 4'),
              description: t('Header 4 is «Слабые стороны»'),
            },
          },
        ],
      ],
    },
    {
      label: t('Zoom'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'show_data_zoom_x',
            config: {
              type: 'CheckboxControl',
              label: t('Show X Zoom'),
              renderTrigger: true,
              default: true,
              description: t('Show X Zoom'),
            },
          },
          {
            name: 'show_data_zoom_y',
            config: {
              type: 'CheckboxControl',
              label: t('Show Y Zoom'),
              renderTrigger: true,
              default: false,
              description: t('Show Y Zoom'),
            },
          },
        ],
      ],
    },
  ],
};

export default config;
